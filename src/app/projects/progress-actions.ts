"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, verifyProjectOwnership } from "@/lib/auth";

type ProgressEntry = {
  itemId: string;
  weekNum: number;
  percent: number; // 0-100
  notes?: string;
};

export type UpdateProgressResult = {
  ok?: true;
  error?: string;
  saved?: number;
};

/**
 * Bulk upsert progress entries.
 * - Verify project ownership.
 * - Filter entries to items yang memang milik project ini.
 * - Cell dengan percent = 0 dan tidak ada existing → skip (gak insert noise).
 * - Cell dengan existing entry → update.
 * - Cell baru dengan percent > 0 → insert.
 */
export async function updateProgress(
  projectId: string,
  payloadJson: string,
): Promise<UpdateProgressResult> {
  let payload: ProgressEntry[];
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

  // Validate + sanitize entries
  const cleaned = payload
    .filter((p) => p && typeof p.itemId === "string" && p.itemId)
    .map((p) => ({
      itemId: p.itemId,
      weekNum: Math.max(1, Math.min(520, Math.floor(Number(p.weekNum) || 0))),
      percent: Math.max(0, Math.min(100, Number(p.percent) || 0)),
      notes: p.notes ?? null,
    }))
    .filter((p) => p.weekNum > 0);

  if (cleaned.length === 0) {
    return { ok: true, saved: 0 };
  }

  // Verify all itemIds belong to this project (defense)
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

  // Bulk upsert via INSERT ... ON CONFLICT DO UPDATE
  try {
    await db
      .insert(schema.projectItemProgress)
      .values(
        filtered.map((p) => ({
          projectItemId: p.itemId,
          weekNum: p.weekNum,
          percentActual: p.percent.toFixed(2),
          notes: p.notes,
        })),
      )
      .onConflictDoUpdate({
        target: [
          schema.projectItemProgress.projectItemId,
          schema.projectItemProgress.weekNum,
        ],
        set: {
          percentActual: sql`excluded.percent_actual`,
          notes: sql`excluded.notes`,
          updatedAt: sql`now()`,
        },
      });
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Gagal simpan progres: ${e.message}`
          : "Gagal simpan progres.",
    };
  }

  revalidatePath(`/projects/${projectId}/progress`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, saved: filtered.length };
}
