import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { EditProjectForm } from "./form";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ProjectRow = typeof schema.projects.$inferSelect;

async function loadProject(
  id: string,
  userId: string,
): Promise<ProjectRow | null> {
  const rows = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  let project: ProjectRow | null = null;
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
      <section className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-8">
          <Link
            href={`/projects/${project.id}`}
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent"
          >
            ← {project.name}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Edit Project
          </h1>
        </header>
        <EditProjectForm project={project} />
      </section>
    </AppShell>
  );
}
