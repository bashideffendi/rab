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
      <section className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href="/projects"
          className="text-sm font-medium text-muted-foreground hover:text-accent"
        >
          ← Projects
        </Link>

        {/* === Project Header === */}
        <header className="mb-6 mt-3 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {project.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={project.status}>{project.status}</Badge>
                {project.regionName && (
                  <Badge tone="accent">📍 {project.regionName}</Badge>
                )}
                {project.tahun && (
                  <Badge tone="default">Tahun {project.tahun}</Badge>
                )}
                <span className="font-mono text-muted-foreground">
                  {project.id.slice(0, 8)}
                </span>
              </div>
            </div>
          </div>

          {/* Primary actions */}
          <div className="mb-3 flex flex-wrap gap-2">
            <a href={`/api/projects/${project.id}/export`} download>
              <Button variant="primary" size="sm">
                ↓ Excel
              </Button>
            </a>
            <Link
              href={`/projects/${project.id}/print`}
              target="_blank"
              rel="noopener"
            >
              <Button variant="primary" size="sm">
                ↓ PDF
              </Button>
            </Link>
            <Link href={`/projects/${project.id}/ai-import`}>
              <Button variant="primary" size="sm">
                ✨ AI Generate
              </Button>
            </Link>
            <Link href={`/projects/${project.id}/schedule`}>
              <Button variant="secondary" size="sm">
                📅 Schedule
              </Button>
            </Link>
            <Link href={`/projects/${project.id}/breakdown`}>
              <Button variant="secondary" size="sm">
                📊 Breakdown
              </Button>
            </Link>
          </div>

          {/* Secondary actions */}
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Link href={`/projects/${project.id}/edit`}>
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            </Link>
            <DuplicateButton id={project.id} />
            <ArchiveButton
              id={project.id}
              isArchived={project.isArchived}
            />
            <div className="ml-auto">
              <DeleteProjectButton
                id={project.id}
                projectName={project.name}
              />
            </div>
          </div>
        </header>

        {/* === Metadata Grid === */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetaCard label="Klien / Pemilik" value={project.opd} icon="👤" />
          <MetaCard
            label="Penanggung Jawab"
            value={project.ownerName}
            icon="✍️"
          />
          <MetaCard
            label="Lokasi"
            value={
              project.regionName
                ? `${project.regionName}${project.regionIkk ? ` · IKK ${project.regionIkk}` : ""}`
                : null
            }
            icon="📍"
          />
          <MetaCard label="Alamat" value={project.alamat} icon="🏠" />
          <MetaCard
            label="Tahun"
            value={project.tahun?.toString() ?? null}
            icon="📅"
          />
          <MetaCard
            label="Konfigurasi RAB"
            value={`PPN ${project.ppnPercent}% · Overhead ${project.overheadPercent}% · Bulat ${project.dibulatkanKe.toLocaleString("id-ID")}`}
            icon="⚙️"
          />
        </div>

        {project.lat && project.lng && (
          <div className="mb-6 overflow-hidden rounded-md border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs">
              <span className="font-medium text-muted-foreground">
                📍 Peta Lokasi
              </span>
              <a
                href={`https://www.google.com/maps?q=${project.lat},${project.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-accent"
              >
                Buka di Google Maps ↗
              </a>
            </div>
            <iframe
              title="Peta lokasi proyek"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(project.lng) - 0.005},${Number(project.lat) - 0.003},${Number(project.lng) + 0.005},${Number(project.lat) + 0.003}&layer=mapnik&marker=${project.lat},${project.lng}`}
              className="h-64 w-full border-0"
              loading="lazy"
            />
          </div>
        )}

        <div className="mb-6 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground shadow-sm">
          <span className="font-medium">Created:</span>{" "}
          {formatDate(project.createdAt)}
          <span className="mx-3">·</span>
          <span className="font-medium">Updated:</span>{" "}
          {formatDate(project.updatedAt)}
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

function MetaCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null;
  icon: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{icon}</span>
        <span>{label}</span>
      </p>
      <p className="text-sm font-medium text-foreground">
        {value ?? <span className="text-muted-foreground italic">—</span>}
      </p>
    </div>
  );
}
