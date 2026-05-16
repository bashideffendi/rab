import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { ScheduleEditor } from "./editor";

export const dynamic = "force-dynamic";

type ItemRow = {
  id: string;
  wbsCode: string | null;
  wbsName: string | null;
  name: string;
  unit: string;
  volume: string;
  unitPrice: string;
  startWeek: number | null;
  durationWeeks: number | null;
};

type PlannedEntry = {
  itemId: string;
  weekNum: number;
  percent: number;
};

async function loadProject(id: string, userId: string) {
  const rows = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
    })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

async function loadItems(projectId: string): Promise<ItemRow[]> {
  const rows = await db
    .select({
      id: schema.projectItems.id,
      wbsCode: schema.wbsItems.code,
      wbsName: schema.wbsItems.name,
      customName: schema.projectItems.customName,
      customUnit: schema.projectItems.customUnit,
      volume: schema.projectItems.volume,
      customUnitPrice: schema.projectItems.customUnitPrice,
      startWeek: schema.projectItems.startWeek,
      durationWeeks: schema.projectItems.durationWeeks,
    })
    .from(schema.projectItems)
    .leftJoin(
      schema.wbsItems,
      eq(schema.wbsItems.id, schema.projectItems.wbsItemId),
    )
    .where(eq(schema.projectItems.projectId, projectId))
    .orderBy(asc(schema.projectItems.sortOrder));

  return rows.map((r) => ({
    id: r.id,
    wbsCode: r.wbsCode,
    wbsName: r.wbsName,
    name: r.customName ?? "(custom)",
    unit: r.customUnit ?? "",
    volume: r.volume,
    unitPrice: r.customUnitPrice ?? "0",
    startWeek: r.startWeek,
    durationWeeks: r.durationWeeks,
  }));
}

async function loadPlanned(itemIds: string[]): Promise<PlannedEntry[]> {
  if (itemIds.length === 0) return [];
  const rows = await db
    .select({
      itemId: schema.projectItemPlanned.projectItemId,
      weekNum: schema.projectItemPlanned.weekNum,
      percent: schema.projectItemPlanned.percentPlanned,
    })
    .from(schema.projectItemPlanned)
    .where(inArray(schema.projectItemPlanned.projectItemId, itemIds));
  return rows.map((r) => ({
    itemId: r.itemId,
    weekNum: r.weekNum,
    percent: Number(r.percent),
  }));
}

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const project = await loadProject(id, user.id);
  if (!project) notFound();

  const items = await loadItems(project.id);
  const planned = await loadPlanned(items.map((i) => i.id));

  return (
    <AppShell>
      <section className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm font-medium text-muted-foreground hover:text-accent"
        >
          ← {project.name}
        </Link>

        <header className="mt-2 mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Time Schedule
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight">
            Jadwal Pekerjaan & Gantt Chart
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Tentukan minggu mulai dan durasi pengerjaan setiap item. Bobot
            pekerjaan dihitung otomatis berdasarkan persentase nilai terhadap
            total project. Gantt chart diperbarui secara real-time.
          </p>
        </header>

        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            Belum ada item RAB di project ini. Tambahkan item terlebih dahulu
            di{" "}
            <Link
              href={`/projects/${project.id}`}
              className="text-accent hover:underline"
            >
              halaman project
            </Link>
            .
          </div>
        ) : (
          <ScheduleEditor
            projectId={project.id}
            initialItems={items}
            initialPlanned={planned}
          />
        )}
      </section>
    </AppShell>
  );
}
