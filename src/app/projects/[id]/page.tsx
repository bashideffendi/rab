import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteProjectButton } from "@/components/delete-project-button";
import {
  DuplicateButton,
  ArchiveButton,
} from "@/components/duplicate-archive-buttons";
import { formatDate } from "@/lib/utils";
import { WbsSection } from "./wbs-section";
import { ItemsSection } from "./items-section";

export const dynamic = "force-dynamic";

type ProjectRow = typeof schema.projects.$inferSelect;
type ProjectWithRegion = ProjectRow & {
  regionName: string | null;
  regionIkk: string | null;
};

async function loadProject(
  id: string,
  userId: string,
): Promise<ProjectWithRegion | null> {
  const rows = await db
    .select({
      project: schema.projects,
      regionName: schema.regions.name,
      regionIkk: schema.regions.ikk,
    })
    .from(schema.projects)
    .leftJoin(
      schema.regions,
      eq(schema.regions.id, schema.projects.regionId),
    )
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!rows[0]) return null;
  return {
    ...rows[0].project,
    regionName: rows[0].regionName,
    regionIkk: rows[0].regionIkk,
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  let project: Awaited<ReturnType<typeof loadProject>> = null;
  let dbError: string | null = null;
  try {
    project = await loadProject(id, user.id);
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
            <p className="mb-2 text-sm font-semibold text-danger">
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
          className="text-sm font-medium text-muted-foreground hover:text-accent"
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
          <div className="flex shrink-0 flex-wrap gap-2">
            <a href={`/api/projects/${project.id}/export`} download>
              <Button variant="primary" size="sm">
                ↓ Export Excel
              </Button>
            </a>
            <Link
              href={`/projects/${project.id}/breakdown`}
              className="inline-block"
            >
              <Button variant="secondary" size="sm">
                Breakdown
              </Button>
            </Link>
            <Link href={`/projects/${project.id}/edit`}>
              <Button variant="secondary" size="sm">
                Edit
              </Button>
            </Link>
            <DuplicateButton id={project.id} />
            <ArchiveButton
              id={project.id}
              isArchived={project.isArchived}
            />
            <DeleteProjectButton id={project.id} projectName={project.name} />
          </div>
        </header>

        <div className="grid gap-px overflow-hidden rounded border border-border bg-border md:grid-cols-2">
          <DetailRow label="Klien / Pemilik" value={project.opd} />
          <DetailRow label="Penanggung Jawab" value={project.ownerName} />
          <DetailRow
            label="Lokasi"
            value={
              project.regionName
                ? project.regionIkk
                  ? `${project.regionName} · IKK ${project.regionIkk}`
                  : `${project.regionName} · IKK belum ada`
                : null
            }
          />
          <DetailRow label="Tahun" value={project.tahun?.toString() ?? null} />
          <DetailRow label="Alamat" value={project.alamat} />
          <DetailRow
            label="PPN / Overhead"
            value={`PPN ${project.ppnPercent}% · Overhead ${project.overheadPercent}%`}
          />
          <DetailRow label="Status" value={project.status} />
          <DetailRow label="Created" value={formatDate(project.createdAt)} />
          <DetailRow label="Updated" value={formatDate(project.updatedAt)} />
        </div>

        {project.notes && (
          <div className="mt-6 rounded border border-border p-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Catatan
            </p>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {project.notes}
            </p>
          </div>
        )}

        <WbsSection projectId={project.id} />
        <ItemsSection
          projectId={project.id}
          ppnPercent={project.ppnPercent}
          overheadPercent={project.overheadPercent}
          dibulatkanKe={project.dibulatkanKe}
        />
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
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}
