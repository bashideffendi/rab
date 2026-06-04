"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  requireUser,
  verifyProjectOwnership,
  assertNotLocked,
} from "@/lib/auth";

/**
 * Bulk reorder sortOrder sesuai urutan ID yang dikirim — dipakai oleh
 * drag-and-drop. Semua item harus dalam group WBS yang sama (dicek
 * server-side).
 */

async function loadItemMeta(
  itemId: string,
  projectId: string,
): Promise<{ id: string; wbsItemId: string | null } | null> {
  const rows = await db
    .select({
      id: schema.projectItems.id,
      wbsItemId: schema.projectItems.wbsItemId,
    })
    .from(schema.projectItems)
    .where(
      and(
        eq(schema.projectItems.id, itemId),
        eq(schema.projectItems.projectId, projectId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Bulk renumber sortOrder sesuai urutan `orderedItemIds` di group yang
 * sama (semua harus punya wbsItemId yang sama, dicek server-side).
 * Dipakai oleh drag-drop di client.
 */
export async function reorderItemsInGroup(
  projectId: string,
  orderedItemIds: string[],
): Promise<{ ok?: true; error?: string }> {
  if (!projectId || !Array.isArray(orderedItemIds) || orderedItemIds.length === 0) {
    return { error: "Input gak valid." };
  }

  const user = await requireUser();
  try {
    await verifyProjectOwnership(projectId, user.id);
    await assertNotLocked(projectId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Akses ditolak." };
  }

  // Verify semua item milik project ini + ambil group dari item pertama
  const firstMeta = await loadItemMeta(orderedItemIds[0], projectId);
  if (!firstMeta) return { error: "Item gak ditemukan." };
  const expectedWbs = firstMeta.wbsItemId;

  for (const id of orderedItemIds) {
    const m = await loadItemMeta(id, projectId);
    if (!m) return { error: "Item gak ditemukan." };
    if (m.wbsItemId !== expectedWbs) {
      return { error: "Item di-reorder harus dalam group WBS yang sama." };
    }
  }

  // Renumber: 10, 20, 30, ... (kelipatan 10 supaya insert/swap masa depan
  // bisa nempel di antara tanpa renumber massal)
  try {
    for (let i = 0; i < orderedItemIds.length; i++) {
      await db
        .update(schema.projectItems)
        .set({ sortOrder: (i + 1) * 10, updatedAt: new Date() })
        .where(
          and(
            eq(schema.projectItems.id, orderedItemIds[i]),
            eq(schema.projectItems.projectId, projectId),
          ),
        );
    }
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Gagal reorder: ${e.message}`
          : "Gagal reorder items.",
    };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
