import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { WbsAddForm } from "./wbs-add-form";
import { WbsList, type WbsListItem } from "./wbs-list";
import { compareWbsCode } from "@/lib/utils";

async function loadWbs(projectId: string): Promise<WbsListItem[]> {
  const rows = await db
    .select({
      id: schema.wbsItems.id,
      code: schema.wbsItems.code,
      name: schema.wbsItems.name,
      level: schema.wbsItems.level,
      notes: schema.wbsItems.notes,
      sortOrder: schema.wbsItems.sortOrder,
    })
    .from(schema.wbsItems)
    .where(eq(schema.wbsItems.projectId, projectId))
    .orderBy(asc(schema.wbsItems.sortOrder));

  // Items yang belum pernah di-reorder semua punya sortOrder = 0 (default).
  // Fallback: kalau semua sama, ranking by code (compareWbsCode). Kalau ada
  // yang udah di-reorder, sortOrder ASC menang; tiebreak code.
  return rows
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return compareWbsCode(a.code, b.code);
    })
    .map(({ sortOrder: _so, ...rest }) => rest);
}

export async function WbsSection({ projectId }: { projectId: string }) {
  let items: WbsListItem[] = [];
  let dbError: string | null = null;
  try {
    items = await loadWbs(projectId);
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Gagal load WBS.";
  }

  return (
    <section className="mt-10">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Work Breakdown Structure
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">
            Struktur Pekerjaan
          </h2>
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {items.length} item
        </span>
      </header>

      {dbError ? (
        <div className="rounded border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
          {dbError}
        </div>
      ) : items.length === 0 ? (
        <p className="mb-4 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada struktur WBS. Mulai dengan kode level pertama (
          <code className="font-mono">1</code>), kemudian lanjutkan ke
          sub-item (<code className="font-mono">1.1</code>,{" "}
          <code className="font-mono">1.2</code>, dst).
        </p>
      ) : (
        <WbsList projectId={projectId} initialItems={items} />
      )}

      <WbsAddForm projectId={projectId} />
    </section>
  );
}
