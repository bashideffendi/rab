import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { formatDate } from "@/lib/utils";
import { WbsSection } from "./wbs-section";
import { ItemsSection } from "./items-section";

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
          <div className="flex shrink-0 gap-2">
            <Link href={`/projects/${project.id}/edit`}>
              <Button variant="secondary" size="sm">
                Edit
              </Button>
            </Link>
            <DeleteProjectButton id={project.id} projectName={project.name} />
          </div>
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

        <WbsSection projectId={project.id} />
        <ItemsSection projectId={project.id} />
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
