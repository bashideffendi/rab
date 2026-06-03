"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, verifyProjectOwnership } from "@/lib/auth";
import { normalizeUnit } from "@/lib/units";
import { logAudit } from "@/lib/audit";

export type ImportRow = {
  name: string;
  unit: string;
  volume: number;
  unitPrice: number;
};

/**
 * Commit hasil parse Excel jadi custom project_items. Dipanggil client setelah
 * user review preview. wbsOption 'auto' bikin/pakai WBS 'Import Excel' (code 99),
 * 'none' = item tanpa WBS.
 */
export async function applyExcelImport(
  projectId: string,
  rows: ImportRow[],
  wbsOption: "none" | "auto",
): Promise<{ error?: string; inserted?: number }> {
  const user = await requireUser();
  try {
    await verifyProjectOwnership(projectId, user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gak punya akses ke project ini." };
  }

  const valid = rows.filter(
    (r) =>
      r?.name?.trim() &&
      Number.isFinite(r.volume) &&
      r.volume >= 0 &&
      Number.isFinite(r.unitPrice) &&
      r.unitPrice >= 0,
  );
  if (valid.length === 0) return { error: "Tidak ada baris valid untuk diimpor." };

  // WBS tujuan
  let wbsItemId: string | null = null;
  if (wbsOption === "auto") {
    const code = "99";
    const existing = await db
      .select({ id: schema.wbsItems.id })
      .from(schema.wbsItems)
      .where(
        and(
          eq(schema.wbsItems.projectId, projectId),
          eq(schema.wbsItems.code, code),
        ),
      )
      .limit(1);
    if (existing[0]) {
      wbsItemId = existing[0].id;
    } else {
      const [w] = await db
        .insert(schema.wbsItems)
        .values({
          projectId,
          code,
          name: "Import Excel",
          level: 0,
          sortOrder: 9900,
        })
        .returning({ id: schema.wbsItems.id });
      wbsItemId = w?.id ?? null;
    }
  }

  // sortOrder append (gak overwrite item existing)
  const [last] = await db
    .select({ sortOrder: schema.projectItems.sortOrder })
    .from(schema.projectItems)
    .where(eq(schema.projectItems.projectId, projectId))
    .orderBy(desc(schema.projectItems.sortOrder))
    .limit(1);
  let sortOrder = (last?.sortOrder ?? 0) + 1;

  type ItemRow = typeof schema.projectItems.$inferInsert;
  const itemRows: ItemRow[] = valid.map((r) => ({
    projectId,
    wbsItemId,
    ahspItemId: null,
    customName: r.name.trim().slice(0, 200),
    customUnit: normalizeUnit(r.unit) || "ls",
    customUnitPrice: r.unitPrice.toFixed(2),
    volume: r.volume.toString(),
    sortOrder: sortOrder++,
  }));

  try {
    const CHUNK = 200;
    for (let i = 0; i < itemRows.length; i += CHUNK) {
      await db.insert(schema.projectItems).values(itemRows.slice(i, i + CHUNK));
    }
  } catch (e) {
    return {
      error: e instanceof Error ? `Gagal simpan: ${e.message}` : "Gagal simpan.",
    };
  }

  await logAudit({
    projectId,
    userId: user.id,
    action: "import_excel",
    summary: `Import ${itemRows.length} item dari Excel`,
  });
  revalidatePath(`/projects/${projectId}`);
  return { inserted: itemRows.length };
}
