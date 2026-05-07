import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DuplicateButton,
  ArchiveButton,
} from "@/components/duplicate-archive-buttons";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { Tooltip } from "@/components/ui/tooltip";
import { PencilIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/lib/auth";
import { TemplatesGallery } from "./templates-gallery";

export const dynamic = "force-dynamic";

async function loadProjects(userId: string, archived: boolean) {
  return db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      opd: schema.projects.opd,
      ownerName: schema.projects.ownerName,
      status: schema.projects.status,
      isArchived: schema.projects.isArchived,
      updatedAt: schema.projects.updatedAt,
    })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.userId, userId),
        eq(schema.projects.isArchived, archived),
      ),
    )
    .orderBy(desc(schema.projects.updatedAt))
    .limit(200);
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const isArchivedTab = sp.tab === "archived";

  let projects: Awaited<ReturnType<typeof loadProjects>> = [];
  let dbError: string | null = null;
  try {
    projects = await loadProjects(user.id, isArchivedTab);
  } catch (e) {
    dbError =
      e instanceof Error
        ? e.message
        : "Gagal connect ke database. Cek DATABASE_URL.";
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Workspace
            </p>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
              {isArchivedTab ? "Arsip Project" : "Project Saya"}
              {projects.length > 0 && (
                <span className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-base font-semibold tabular-nums text-muted-foreground">
                  {projects.length}
                </span>
              )}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isArchivedTab
                ? "Project yang sudah diarsipkan. Bisa diaktifkan kembali kapan saja."
                : "Kelola semua project RAB dalam satu workspace."}
            </p>
          </div>
          <Link href="/projects/new">
            <Button variant="primary" size="md">
              + Project Baru
            </Button>
          </Link>
        </header>

        {dbError ? (
          <DbErrorState message={dbError} />
        ) : (
          <>
            <div className="mb-6 flex gap-2 border-b border-border">
              <Link
                href="/projects"
                className={
                  !isArchivedTab
                    ? "border-b-2 border-accent px-3 py-2 text-sm font-medium text-foreground"
                    : "px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                }
              >
                Aktif
              </Link>
              <Link
                href="/projects?tab=archived"
                className={
                  isArchivedTab
                    ? "border-b-2 border-accent px-3 py-2 text-sm font-medium text-foreground"
                    : "px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                }
              >
                Arsip
              </Link>
            </div>

            {!isArchivedTab && <TemplatesGallery />}
            {projects.length === 0 ? (
              <EmptyState isArchived={isArchivedTab} />
            ) : (
              <ProjectsTable projects={projects} />
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}

function DbErrorState({ message }: { message: string }) {
  return (
    <div className="rounded border border-danger/40 bg-danger/5 p-6">
      <p className="mb-2 text-sm font-semibold text-danger">
        DB Error
      </p>
      <p className="mb-4 text-sm text-foreground">{message}</p>
      <pre className="overflow-x-auto rounded bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
        {`# Quickstart Postgres lokal
docker compose up -d
cp .env.example .env.local
# isi DATABASE_URL ke postgres://rabin:rabin@localhost:5432/rabin
npm run db:push`}
      </pre>
    </div>
  );
}

function EmptyState({ isArchived }: { isArchived: boolean }) {
  if (isArchived) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-20 text-center">
        <span className="mb-3 text-4xl">📦</span>
        <h2 className="mb-2 text-lg font-bold tracking-tight">
          Belum ada project diarsipkan
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Project yang diarsipkan dari tab Aktif akan muncul di sini. Arsip
          membantu menjaga workspace tetap rapi tanpa menghapus data.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-20 text-center">
      <span className="mb-3 text-4xl">📋</span>
      <h2 className="mb-2 text-lg font-bold tracking-tight">
        Workspace masih kosong
      </h2>
      <p className="mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
        Setiap project memiliki struktur pekerjaan (WBS) dan rincian RAB
        sendiri. Pilih item dari library AHSP atau buat custom — total dan
        rekapitulasi terhitung otomatis.
      </p>
      <Link href="/projects/new">
        <Button variant="primary">+ Buat Project Pertama</Button>
      </Link>
    </div>
  );
}

function ProjectsTable({
  projects,
}: {
  projects: Awaited<ReturnType<typeof loadProjects>>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Project</th>
            <th className="hidden px-4 py-3 lg:table-cell">Status</th>
            <th className="hidden px-4 py-3 text-right md:table-cell">
              Diperbarui
            </th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.id}
              className="border-t border-border transition-colors hover:bg-muted/30"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/projects/${p.id}`}
                  className="block hover:text-accent"
                >
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.opd ?? "—"}
                    {p.ownerName ? (
                      <>
                        <span className="mx-1.5">·</span>
                        PIC: {p.ownerName}
                      </>
                    ) : null}
                  </p>
                </Link>
                {/* Mobile: status + date inline since columns hidden */}
                <div className="mt-1.5 flex items-center gap-3 text-xs lg:hidden">
                  <Badge tone={p.status}>{p.status}</Badge>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {formatDate(p.updatedAt)}
                  </span>
                </div>
              </td>
              <td className="hidden px-4 py-3 lg:table-cell">
                <Badge tone={p.status}>{p.status}</Badge>
              </td>
              <td className="hidden px-4 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums md:table-cell">
                {formatDate(p.updatedAt)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Tooltip content="Edit data project">
                    <Link href={`/projects/${p.id}/edit`}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 px-0"
                        aria-label="Edit project"
                      >
                        <PencilIcon size={20} />
                      </Button>
                    </Link>
                  </Tooltip>
                  <DuplicateButton id={p.id} compact />
                  <ArchiveButton
                    id={p.id}
                    isArchived={p.isArchived}
                    compact
                  />
                  <DeleteProjectButton
                    id={p.id}
                    projectName={p.name}
                    compact
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
