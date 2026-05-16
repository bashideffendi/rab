"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, verifyProjectOwnership } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * Jumlah minggu ke belakang dari minggu berjalan yang dianggap "historical".
 * Entri yang lebih tua dari ini akan tetap di-save (soft lock), tapi dicatat
 * di project_audit_log untuk transparansi.
 */
const HISTORICAL_WEEK_THRESHOLD = 2;

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
  historicalCount?: number;
};

function computeCurrentWeek(
  startedAt: string | null,
  createdAt: Date,
): number {
  const start = startedAt ? new Date(`${startedAt}T00:00:00`) : createdAt;
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  if (diffMs < 0) return 1;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(days / 7) + 1);
}

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

  // Hitung minggu berjalan project ini (buat deteksi historical edits)
  const projectRows = await db
    .select({
      startedAt: schema.projects.startedAt,
      createdAt: schema.projects.createdAt,
    })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);
  const currentWeek = projectRows[0]
    ? computeCurrentWeek(projectRows[0].startedAt, projectRows[0].createdAt)
    : 1;
  const lockedBefore = currentWeek - HISTORICAL_WEEK_THRESHOLD;
  const historical = filtered.filter((p) => p.weekNum < lockedBefore);

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

  if (historical.length > 0) {
    await logAudit({
      projectId,
      userId: user.id,
      action: "progress_historical_edit",
      summary: `Edit realisasi minggu lampau (${historical.length} entri)`,
      details: {
        historicalCount: historical.length,
        currentWeek,
        lockedBefore,
        weekNumbers: Array.from(
          new Set(historical.map((h) => h.weekNum)),
        ).sort((a, b) => a - b),
      },
    });
  }

  revalidatePath(`/projects/${projectId}/progress`);
  revalidatePath(`/projects/${projectId}`);
  return {
    ok: true,
    saved: filtered.length,
    historicalCount: historical.length,
  };
}
