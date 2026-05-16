"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, verifyProjectOwnership } from "@/lib/auth";

/**
 * Item reorder dalam group WBS yang sama (atau group "tanpa WBS"). Items
 * di group berbeda gak bisa di-swap — itu butuh ubah wbsItemId, bukan
 * sortOrder.
 *
 * Strategy:
 * - `moveItemUp` / `moveItemDown`: swap sortOrder dengan item adjacent.
 * - `reorderItemsInGroup`: bulk renumber sortOrder sesuai urutan ID
 *   yang dikirim (untuk drag-drop). Lebih kuat — bisa pindah jauh.
 */

async function loadGroupItems(
  projectId: string,
  wbsItemId: string | null,
): Promise<Array<{ id: string; sortOrder: number }>> {
  const condition = wbsItemId
    ? and(
        eq(schema.projectItems.projectId, projectId),
        eq(schema.projectItems.wbsItemId, wbsItemId),
      )
    : and(
        eq(schema.projectItems.projectId, projectId),
        isNull(schema.projectItems.wbsItemId),
      );
  const rows = await db
    .select({
      id: schema.projectItems.id,
      sortOrder: schema.projectItems.sortOrder,
    })
    .from(schema.projectItems)
    .where(condition)
    .orderBy(asc(schema.projectItems.sortOrder));
  return rows;
}

async function loadItemMeta(
  itemId: string,
  projectId: string,
): Promise<{ id: string; wbsItemId: string | null; sortOrder: number } | null> {
  const rows = await db
    .select({
      id: schema.projectItems.id,
      wbsItemId: schema.projectItems.wbsItemId,
      sortOrder: schema.projectItems.sortOrder,
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

async function swapWithNeighbor(
  itemId: string,
  projectId: string,
  direction: "up" | "down",
): Promise<void> {
  const user = await requireUser();
  await verifyProjectOwnership(projectId, user.id);

  const cur = await loadItemMeta(itemId, projectId);
  if (!cur) return;

  const group = await loadGroupItems(projectId, cur.wbsItemId);
  const idx = group.findIndex((g) => g.id === itemId);
  if (idx < 0) return;

  const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
  if (neighborIdx < 0 || neighborIdx >= group.length) return; // udah di ujung

  const neighbor = group[neighborIdx];

  // Swap sortOrder. Pakai trick "set both ke value baru" supaya kalau
  // dua items punya sortOrder sama (legacy data), tetep konsisten.
  await db
    .update(schema.projectItems)
    .set({ sortOrder: neighbor.sortOrder, updatedAt: new Date() })
    .where(eq(schema.projectItems.id, cur.id));
  await db
    .update(schema.projectItems)
    .set({ sortOrder: cur.sortOrder, updatedAt: new Date() })
    .where(eq(schema.projectItems.id, neighbor.id));

  revalidatePath(`/projects/${projectId}`);
}

export async function moveItemUp(formData: FormData) {
  const itemId = (formData.get("itemId") ?? "").toString();
  const projectId = (formData.get("projectId") ?? "").toString();
  if (!itemId || !projectId) return;
  await swapWithNeighbor(itemId, projectId, "up");
}

export async function moveItemDown(formData: FormData) {
  const itemId = (formData.get("itemId") ?? "").toString();
  const projectId = (formData.get("projectId") ?? "").toString();
  if (!itemId || !projectId) return;
  await swapWithNeighbor(itemId, projectId, "down");
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
