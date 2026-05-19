"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, verifyProjectOwnership } from "@/lib/auth";

/**
 * Bulk renumber sortOrder untuk wbs_items sesuai urutan `orderedIds`.
 * Dipakai oleh drag-and-drop di WbsList. Sort akhir di UI: ORDER BY
 * sortOrder ASC, tiebreak by code.
 *
 * Note: gak ada batasan parentId — user boleh reorder flat. Hirarki visual
 * (paddingLeft per level) tetep, tapi posisi parent vs children adalah
 * tanggung jawab user.
 */
export async function reorderWbsItems(
  projectId: string,
  orderedIds: string[],
): Promise<{ ok?: true; error?: string }> {
  if (
    !projectId ||
    !Array.isArray(orderedIds) ||
    orderedIds.length === 0
  ) {
    return { error: "Input gak valid." };
  }

  const user = await requireUser();
  try {
    await verifyProjectOwnership(projectId, user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Akses ditolak." };
  }

  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(schema.wbsItems)
        .set({ sortOrder: (i + 1) * 10 })
        .where(
          and(
            eq(schema.wbsItems.id, orderedIds[i]),
            eq(schema.wbsItems.projectId, projectId),
          ),
        );
    }
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Gagal reorder: ${e.message}`
          : "Gagal reorder WBS.",
    };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
