import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatDate } from "@/lib/utils";

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  create: { label: "Project dibuat", icon: "✨" },
  update: { label: "Data diperbarui", icon: "✏️" },
  archive: { label: "Diarsipkan", icon: "📦" },
  unarchive: { label: "Diaktifkan kembali", icon: "↩️" },
  duplicate: { label: "Diduplikasi", icon: "📋" },
  // Mutasi nilai item (ditambah round-3 — dulu gak ke-log sama sekali)
  item_create: { label: "Item ditambah", icon: "➕" },
  item_update: { label: "Item diperbarui", icon: "✏️" },
  item_inline_edit: { label: "Item diedit (inline)", icon: "✏️" },
  item_delete: { label: "Item dihapus", icon: "🗑️" },
  stage_bulk: { label: "Tahap ditambah", icon: "🧱" },
  ai_import: { label: "AI extract", icon: "🤖" },
  import_excel: { label: "Import Excel", icon: "⬆️" },
  lock: { label: "RAB dikunci", icon: "🔒" },
  unlock: { label: "RAB dibuka", icon: "🔓" },
  progress_historical_edit: { label: "Edit progres lampau", icon: "⏪" },
};

type Entry = {
  id: string;
  action: string;
  summary: string | null;
  createdAt: Date;
};

async function loadAuditLog(projectId: string): Promise<Entry[]> {
  return db
    .select({
      id: schema.projectAuditLog.id,
      action: schema.projectAuditLog.action,
      summary: schema.projectAuditLog.summary,
      createdAt: schema.projectAuditLog.createdAt,
    })
    .from(schema.projectAuditLog)
    .where(eq(schema.projectAuditLog.projectId, projectId))
    .orderBy(desc(schema.projectAuditLog.createdAt))
    .limit(20);
}

export async function AuditLogSection({
  projectId,
}: {
  projectId: string;
}) {
  let entries: Entry[] = [];
  try {
    entries = await loadAuditLog(projectId);
  } catch {
    return null;
  }

  if (entries.length === 0) return null;

  return (
    <section className="mt-12">
      <header className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Riwayat Perubahan
        </p>
        <h2 className="mt-1 text-lg font-bold tracking-tight">
          Aktivitas Terakhir
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {entries.length} aktivitas tercatat. Otomatis logged saat data
          project diubah.
        </p>
      </header>

      <ol className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {entries.map((e, i) => {
          const meta = ACTION_LABELS[e.action] ?? {
            label: e.action,
            icon: "•",
          };
          return (
            <li
              key={e.id}
              className={`flex items-start gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm">
                {meta.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {e.summary ?? meta.label}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                  {formatDate(e.createdAt)}
                </p>
              </div>
              <span className="shrink-0 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {e.action}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
