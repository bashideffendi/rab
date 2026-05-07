import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { EditItemForm } from "./form";
import { requireUser, verifyProjectOwnership } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ItemRow = typeof schema.projectItems.$inferSelect;
type WbsOption = { id: string; code: string; name: string };

async function loadItem(
  projectId: string,
  itemId: string,
): Promise<ItemRow | null> {
  const rows = await db
    .select()
    .from(schema.projectItems)
    .where(
      and(
        eq(schema.projectItems.id, itemId),
        eq(schema.projectItems.projectId, projectId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function loadWbs(projectId: string): Promise<WbsOption[]> {
  return db
    .select({
      id: schema.wbsItems.id,
      code: schema.wbsItems.code,
      name: schema.wbsItems.name,
    })
    .from(schema.wbsItems)
    .where(eq(schema.wbsItems.projectId, projectId))
    .orderBy(asc(schema.wbsItems.code));
}

async function loadProjectName(projectId: string): Promise<string | null> {
  const rows = await db
    .select({ name: schema.projects.name })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);
  return rows[0]?.name ?? null;
}

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const user = await requireUser();
  const { id, itemId } = await params;

  let item: ItemRow | null = null;
  let wbsOptions: WbsOption[] = [];
  let projectName: string | null = null;
  let dbError: string | null = null;
  try {
    await verifyProjectOwnership(id, user.id);
    [item, wbsOptions, projectName] = await Promise.all([
      loadItem(id, itemId),
      loadWbs(id),
      loadProjectName(id),
    ]);
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

  if (!item) notFound();

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-8">
          <Link
            href={`/projects/${id}`}
            className="text-sm font-medium text-muted-foreground hover:text-accent"
          >
            ← {projectName ?? "Project"}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Edit Item RAB
          </h1>
        </header>
        <EditItemForm
          itemId={item.id}
          projectId={id}
          wbsOptions={wbsOptions}
          initial={{
            wbsItemId: item.wbsItemId,
            name: item.customName ?? "",
            unit: item.customUnit ?? "",
            volume: item.volume,
            unitPrice: item.customUnitPrice ?? "",
          }}
        />
      </section>
    </AppShell>
  );
}
