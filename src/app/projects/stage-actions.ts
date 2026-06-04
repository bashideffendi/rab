"use server";

import { revalidatePath } from "next/cache";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  requireUser,
  verifyProjectOwnership,
  assertNotLocked,
} from "@/lib/auth";
import { computeAhspPrices } from "@/lib/pricing";
import { logAudit } from "@/lib/audit";

// ─── Bulk create ─────────────────────────────────────────────────────────────

export type BulkItemPayload = {
  ahspItemId: string;
  wbsItemId?: string | null;
  volume: number;
  calculatorType?: string | null;
  calculatorInputs?: Record<string, number> | null;
  volumeFormula?: string | null;
  /** Override label kalau mau (default: pakai AHSP name) */
  customName?: string;
};

export type BulkCreateResult = {
  ok?: true;
  error?: string;
  created?: number;
  warnings?: string[];
};

/**
 * Bulk insert multiple project items dari satu Stage Calculator submission.
 * Single transaction-like: verify ownership, fetch all AHSP names dulu,
 * compute prices in parallel, lalu bulk insert.
 */
export async function createBulkProjectItems(
  projectId: string,
  payloadJson: string,
): Promise<BulkCreateResult> {
  let payload: BulkItemPayload[];
  try {
    payload = JSON.parse(payloadJson);
    if (!Array.isArray(payload)) throw new Error("Payload harus array.");
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Payload JSON gak valid.",
    };
  }

  if (payload.length === 0) {
    return { error: "Tidak ada item yang dipilih untuk ditambah." };
  }

  const user = await requireUser();
  try {
    await verifyProjectOwnership(projectId, user.id);
    await assertNotLocked(projectId);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Akses ditolak ke project.",
    };
  }

  // Get project regionId
  const proj = await db
    .select({ regionId: schema.projects.regionId })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);
  const regionId = proj[0]?.regionId ?? null;

  // Get max sortOrder yang ada → append after itu
  const maxSort = await db
    .select({ s: schema.projectItems.sortOrder })
    .from(schema.projectItems)
    .where(eq(schema.projectItems.projectId, projectId))
    .orderBy(desc(schema.projectItems.sortOrder))
    .limit(1);
  let sortOrder = (maxSort[0]?.s ?? 0) + 1;

  const warnings: string[] = [];
  const valuesToInsert: (typeof schema.projectItems.$inferInsert)[] = [];

  // Bulk price semua AHSP sekaligus (region-aware two-pass + IKK, satu sumber
  // kebenaran — sama dengan item/template/AI). Hindari N+1 query per item.
  const ahspIdList = payload
    .filter((it) => it.ahspItemId)
    .map((it) => it.ahspItemId);
  const priceMap = await computeAhspPrices(ahspIdList, regionId);

  // Fetch nama+unit semua AHSP sekali via inArray (dulu N+1: 1 query/item di
  // loop — kontradiksi komentar "Hindari N+1"). computeAhspPrices cuma balikin
  // price/missing, jadi name/unit perlu fetch terpisah — tapi cukup 1 query.
  const masters = ahspIdList.length
    ? await db
        .select({
          id: schema.ahspItems.id,
          name: schema.ahspItems.name,
          unit: schema.ahspItems.unit,
        })
        .from(schema.ahspItems)
        .where(inArray(schema.ahspItems.id, ahspIdList))
    : [];
  const masterMap = new Map(masters.map((m) => [m.id, m]));

  for (const item of payload) {
    if (!item.ahspItemId) continue;

    const master = masterMap.get(item.ahspItemId);
    if (!master) {
      warnings.push(`AHSP tidak ditemukan: ${item.ahspItemId.slice(0, 8)}`);
      continue;
    }

    const priced = priceMap.get(item.ahspItemId);
    const price = priced?.price ?? "0";
    const missing = priced?.missing ?? [];
    if (missing.length > 0) {
      warnings.push(
        `${master.name.slice(0, 30)}: ${missing.length} material belum ada harga`,
      );
    }

    valuesToInsert.push({
      projectId,
      wbsItemId: item.wbsItemId ?? null,
      ahspItemId: item.ahspItemId,
      customName: item.customName ?? master.name,
      customUnit: master.unit,
      customUnitPrice: price,
      volume: item.volume.toFixed(4),
      calculatorType: item.calculatorType ?? null,
      calculatorInputs: item.calculatorInputs ?? null,
      volumeFormula: item.volumeFormula ?? null,
      sortOrder: sortOrder++,
    });
  }

  if (valuesToInsert.length === 0) {
    return { error: "Tidak ada item valid untuk ditambah." };
  }

  try {
    // Bulk insert
    await db.insert(schema.projectItems).values(valuesToInsert);
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Gagal simpan: ${e.message}`
          : "Gagal simpan items.",
    };
  }

  await logAudit({
    projectId,
    userId: user.id,
    action: "stage_bulk",
    summary: `Tahap: +${valuesToInsert.length} item`,
    details: {
      itemCount: valuesToInsert.length,
      calculatorType: payload[0]?.calculatorType ?? null,
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return {
    ok: true,
    created: valuesToInsert.length,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
