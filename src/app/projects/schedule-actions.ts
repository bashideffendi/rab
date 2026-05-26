"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, verifyProjectOwnership } from "@/lib/auth";

/**
 * Bulk update schedule (start_week + duration_weeks) untuk multiple items
 * dalam 1 project. Payload: array of { itemId, startWeek, durationWeeks }.
 */
export async function updateItemsSchedule(formData: FormData) {
  const projectId = (formData.get("projectId") ?? "").toString();
  const payloadStr = (formData.get("payload") ?? "").toString();
  if (!projectId || !payloadStr) {
    throw new Error("projectId atau payload hilang.");
  }

  const user = await requireUser();
  await verifyProjectOwnership(projectId, user.id);

  let payload: Array<{
    itemId: string;
    startWeek: number | null;
    durationWeeks: number | null;
  }>;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    throw new Error("Payload JSON gak valid.");
  }
  if (!Array.isArray(payload)) {
    throw new Error("Payload harus array.");
  }

  // Clamp ke 1..520 (10 tahun) biar gak ada angka liar yang nge-render table
  // raksasa di Schedule/Progress page.
  const clampWeek = (v: number | null): number | null => {
    if (v == null) return null;
    if (!Number.isFinite(v)) return null;
    const n = Math.floor(v);
    if (n <= 0) return null;
    return Math.min(520, n);
  };

  // Update per item (sequentially — gak terlalu banyak biasanya)
  for (const p of payload) {
    if (!p.itemId) continue;
    await db
      .update(schema.projectItems)
      .set({
        startWeek: clampWeek(p.startWeek),
        durationWeeks: clampWeek(p.durationWeeks),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.projectItems.id, p.itemId),
          eq(schema.projectItems.projectId, projectId),
        ),
      );
  }

  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}`);
}

type PlannedEntry = {
  itemId: string;
  weekNum: number;
  percent: number; // 0-100
};

export type UpdatePlannedResult = {
  ok?: true;
  error?: string;
  saved?: number;
};

/**
 * Bulk upsert bobot rencana per minggu per item.
 * - Verify project ownership.
 * - Filter ke item milik project ini.
 * - Cell dengan percent <= 0 → hapus (kalau ada existing).
 * - Cell > 0 → insert atau update.
 */
export async function updatePlannedDistribution(
  projectId: string,
  payloadJson: string,
): Promise<UpdatePlannedResult> {
  let payload: PlannedEntry[];
  try {
    payload = JSON.parse(payloadJson);
    if (!Array.isArray(payload)) throw new Error("Payload harus array.");
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Payload JSON tidak valid.",
    };
  }

  const user = await requireUser();
  try {
    await verifyProjectOwnership(projectId, user.id);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Akses ditolak.",
    };
  }

  const cleaned = payload
    .filter((p) => p && typeof p.itemId === "string" && p.itemId)
    .map((p) => ({
      itemId: p.itemId,
      weekNum: Math.max(1, Math.min(520, Math.floor(Number(p.weekNum) || 0))),
      percent: Math.max(0, Math.min(100, Number(p.percent) || 0)),
    }))
    .filter((p) => p.weekNum > 0);

  if (cleaned.length === 0) {
    return { ok: true, saved: 0 };
  }

  // Verify all itemIds belong to this project
  const itemIds = Array.from(new Set(cleaned.map((c) => c.itemId)));
  const validItems = await db
    .select({ id: schema.projectItems.id })
    .from(schema.projectItems)
    .where(
      and(
        inArray(schema.projectItems.id, itemIds),
        eq(schema.projectItems.projectId, projectId),
      ),
    );
  const validIdSet = new Set(validItems.map((r) => r.id));
  const filtered = cleaned.filter((c) => validIdSet.has(c.itemId));

  if (filtered.length === 0) {
    return { ok: true, saved: 0 };
  }

  // Split: cells dengan percent > 0 untuk upsert, cells dengan percent = 0 untuk delete
  const upserts = filtered.filter((p) => p.percent > 0);
  const deletes = filtered.filter((p) => p.percent === 0);

  try {
    if (upserts.length > 0) {
      await db
        .insert(schema.projectItemPlanned)
        .values(
          upserts.map((p) => ({
            projectItemId: p.itemId,
            weekNum: p.weekNum,
            percentPlanned: p.percent.toFixed(2),
          })),
        )
        .onConflictDoUpdate({
          target: [
            schema.projectItemPlanned.projectItemId,
            schema.projectItemPlanned.weekNum,
          ],
          set: {
            percentPlanned: sql`excluded.percent_planned`,
            updatedAt: sql`now()`,
          },
        });
    }

    for (const d of deletes) {
      await db
        .delete(schema.projectItemPlanned)
        .where(
          and(
            eq(schema.projectItemPlanned.projectItemId, d.itemId),
            eq(schema.projectItemPlanned.weekNum, d.weekNum),
          ),
        );
    }
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Gagal simpan bobot rencana: ${e.message}`
          : "Gagal simpan bobot rencana.",
    };
  }

  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}/progress`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, saved: upserts.length + deletes.length };
}
