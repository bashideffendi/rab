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
import {
  projectTypeIcon,
  projectTypeLabel,
} from "@/lib/project-types";
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

        {/* === Hero: Name + identitas === */}
        <header className="mb-6 mt-3 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-accent/5 shadow-sm">
          <div className="flex flex-col gap-5 p-6 md:flex-row md:items-start md:justify-between md:p-7">
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {project.projectType && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                    <span>{projectTypeIcon(project.projectType)}</span>
                    {projectTypeLabel(project.projectType)}
                  </span>
                )}
                <Badge tone={project.status}>{project.status}</Badge>
                {project.tahun && (
                  <Badge tone="default">Tahun {project.tahun}</Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                {project.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {[project.opd, project.regionName].filter(Boolean).join(" · ")}
              </p>
            </div>

            {/* Quick stats — luas tanah/bangunan */}
            {(project.luasTanah || project.luasBangunan) && (
              <div className="flex flex-wrap gap-3 md:gap-4">
                {project.luasTanah && (
                  <StatBox
                    label="Luas Tanah"
                    value={`${Number(project.luasTanah).toLocaleString("id-ID")} m²`}
                  />
                )}
                {project.luasBangunan && (
                  <StatBox
                    label="Luas Bangunan"
                    value={`${Number(project.luasBangunan).toLocaleString("id-ID")} m²`}
                  />
                )}
              </div>
            )}
          </div>

          {/* Primary actions */}
          <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 px-6 py-3 md:px-7">
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
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-3 md:px-7">
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
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              ID {project.id.slice(0, 8)}
            </span>
            <DeleteProjectButton
              id={project.id}
              projectName={project.name}
            />
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
          <MetaCard
            label="Alamat Lengkap"
            value={project.alamat}
            icon="🏠"
            className="sm:col-span-2"
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

        {/* === AI Generate Hero Card === */}
        <Link
          href={`/projects/${project.id}/ai-import`}
          className="group mt-10 block overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 via-accent/5 to-card shadow-sm transition-all hover:border-accent/60 hover:shadow-md"
        >
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
            <div className="flex shrink-0 items-center justify-center rounded-lg bg-accent/15 p-3 text-3xl md:h-16 md:w-16">
              ✨
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-accent/40 bg-card px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                  AI Generate
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  Claude Sonnet 4.5 · Vision
                </span>
              </div>
              <h2 className="mt-1.5 text-base font-bold tracking-tight md:text-lg">
                Generate draft WBS & item RAB dari gambar kerja PDF
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Upload denah, tampak, dan potongan dalam satu PDF — AI baca
                dimensi tertulis, susun WBS standar, dan estimasi volume per
                item. Cocokkan dengan AHSP, lalu review per baris sebelum
                disimpan ke project.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <FeatureChip text="Denah · Tampak · Potongan" />
                <FeatureChip text="Auto WBS standar" />
                <FeatureChip text="Match AHSP otomatis" />
              </div>
            </div>
            <div className="shrink-0">
              <span className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform group-hover:translate-x-0.5">
                Mulai Generate
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </div>
        </Link>

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
  className,
}: {
  label: string;
  value: string | null;
  icon: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-border bg-card p-4 shadow-sm ${className ?? ""}`}
    >
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{icon}</span>
        <span>{label}</span>
      </p>
      <p className="text-sm font-medium text-foreground">
        {value ?? <span className="italic text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

function FeatureChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {text}
    </span>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-4 py-3 text-right shadow-sm backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
