import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ProjectRow = typeof schema.projects.$inferSelect;

async function loadProject(id: string): Promise<ProjectRow | null> {
  const rows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let project: Awaited<ReturnType<typeof loadProject>> = null;
  let dbError: string | null = null;
  try {
    project = await loadProject(id);
  } catch (e) {
    dbError =
      e instanceof Error
        ? e.message
        : "Gagal connect ke database. Cek DATABASE_URL.";
  }

  if (dbError) {
    return (
      <AppShell>
        <section className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded border border-danger/40 bg-danger/5 p-6">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-danger">
              DB Error
            </p>
            <p className="text-sm text-foreground">{dbError}</p>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!project) notFound();

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/projects"
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent"
        >
          ← Projects
        </Link>

        <header className="mb-8 mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={project.status}>{project.status}</Badge>
              <span className="font-mono text-[10px] text-muted-foreground">
                {project.id.slice(0, 8)}
              </span>
            </div>
          </div>
          <Button variant="secondary" size="sm" disabled>
            Edit (soon)
          </Button>
        </header>

        <div className="grid gap-px overflow-hidden rounded border border-border bg-border md:grid-cols-2">
          <DetailRow label="OPD / Instansi" value={project.opd} />
          <DetailRow label="PPK / Owner" value={project.ownerName} />
          <DetailRow label="Created" value={formatDate(project.createdAt)} />
          <DetailRow label="Updated" value={formatDate(project.updatedAt)} />
        </div>

        {project.notes && (
          <div className="mt-6 rounded border border-border p-4">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Catatan
            </p>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {project.notes}
            </p>
          </div>
        )}

        <section className="mt-10 rounded border border-dashed border-border p-8 text-center">
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            WBS & Items
          </p>
          <p className="mb-1 text-sm text-foreground">
            Belum ada struktur WBS untuk project ini.
          </p>
          <p className="text-xs text-muted-foreground">
            Editor WBS + item RAB hadir di iterasi berikutnya.
          </p>
        </section>
      </section>
    </AppShell>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="bg-background p-4">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}
