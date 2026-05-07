import { db, schema } from "@/db";

/**
 * Tulis entri ke project_audit_log. Best-effort — gagal di-log
 * gak boleh ngeganggu operasi utama, jadi catch & ignore error.
 */
export async function logAudit(opts: {
  projectId: string;
  userId: string | null;
  action: string;
  summary?: string;
  details?: unknown;
}): Promise<void> {
  try {
    await db.insert(schema.projectAuditLog).values({
      projectId: opts.projectId,
      userId: opts.userId,
      action: opts.action,
      summary: opts.summary ?? null,
      details: opts.details ?? null,
    });
  } catch (e) {
    // Best effort logging
    console.error("[audit] gagal log:", e);
  }
}
