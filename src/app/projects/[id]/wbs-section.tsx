import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { WbsAddForm } from "./wbs-add-form";
import { WbsDeleteButton } from "./wbs-delete-button";

type WbsRow = {
  id: string;
  code: string;
  name: string;
  level: number;
};

async function loadWbs(projectId: string): Promise<WbsRow[]> {
  const rows = await db
    .select({
      id: schema.wbsItems.id,
      code: schema.wbsItems.code,
      name: schema.wbsItems.name,
      level: schema.wbsItems.level,
    })
    .from(schema.wbsItems)
    .where(eq(schema.wbsItems.projectId, projectId))
    .orderBy(asc(schema.wbsItems.code));

  return rows.sort((a, b) => sortByCode(a.code, b.code));
}

// natural sort code "1.10" > "1.2"
function sortByCode(a: string, b: string): number {
  const ap = a.split(".").map(Number);
  const bp = b.split(".").map(Number);
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export async function WbsSection({ projectId }: { projectId: string }) {
  let items: WbsRow[] = [];
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
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            WBS &mdash; Work Breakdown Structure
          </p>
          <h2 className="text-lg font-semibold tracking-tight">
            Struktur pekerjaan
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
        <p className="mb-4 rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada item WBS. Mulai dengan code level-1 (mis. <code>1</code>),
          baru lanjut ke sub-item (<code>1.1</code>, <code>1.2</code>).
        </p>
      ) : (
        <ol className="mb-4 overflow-hidden rounded border border-border">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-4 border-b border-border bg-background px-4 py-3 last:border-b-0 hover:bg-muted/30"
              style={{ paddingLeft: `${1 + it.level * 1.5}rem` }}
            >
              <span className="shrink-0 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                {it.code}
              </span>
              <span className="flex-1 text-sm">{it.name}</span>
              <WbsDeleteButton
                id={it.id}
                projectId={projectId}
                code={it.code}
                name={it.name}
              />
            </li>
          ))}
        </ol>
      )}

      <WbsAddForm projectId={projectId} />
    </section>
  );
}
