import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function loadProjects() {
  return db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      opd: schema.projects.opd,
      ownerName: schema.projects.ownerName,
      status: schema.projects.status,
      updatedAt: schema.projects.updatedAt,
    })
    .from(schema.projects)
    .orderBy(desc(schema.projects.updatedAt))
    .limit(200);
}

export default async function ProjectsPage() {
  let projects: Awaited<ReturnType<typeof loadProjects>> = [];
  let dbError: string | null = null;
  try {
    projects = await loadProjects();
  } catch (e) {
    dbError =
      e instanceof Error
        ? e.message
        : "Gagal connect ke database. Cek DATABASE_URL.";
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">
              Workspace
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Daftar project RAB. Total: {projects.length}.
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
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <ProjectsTable projects={projects} />
        )}
      </section>
    </AppShell>
  );
}

function DbErrorState({ message }: { message: string }) {
  return (
    <div className="rounded border border-danger/40 bg-danger/5 p-6">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-danger">
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-border py-20 text-center">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Workspace kosong
      </p>
      <h2 className="mb-1 text-lg font-semibold tracking-tight">
        Belum ada project
      </h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Mulai dengan bikin project pertama. Tiap project punya WBS sendiri dan
        item RAB yang trace ke regulasi sumbernya.
      </p>
      <Link href="/projects/new">
        <Button variant="primary">+ Project Baru</Button>
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
    <div className="overflow-hidden rounded border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Nama</th>
            <th className="px-4 py-3 font-medium">OPD</th>
            <th className="px-4 py-3 font-medium">Owner</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Updated</th>
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
                  className="font-medium text-foreground hover:text-accent"
                >
                  {p.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {p.opd ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {p.ownerName ?? "—"}
              </td>
              <td className="px-4 py-3">
                <Badge tone={p.status}>{p.status}</Badge>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums">
                {formatDate(p.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
