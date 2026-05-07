import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { ProgressEditor } from "./editor";

export const dynamic = "force-dynamic";

type ItemRow = {
  id: string;
  wbsCode: string | null;
  wbsName: string | null;
  name: string;
  unit: string;
  volume: number;
  unitPrice: number;
  total: number;
  startWeek: number | null;
  durationWeeks: number | null;
};

type ProgressEntry = {
  itemId: string;
  weekNum: number;
  percent: number;
};

async function loadProject(id: string, userId: string) {
  const rows = await db
    .select({ id: schema.projects.id, name: schema.projects.name })
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
      ahspName: schema.ahspItems.name,
      customUnit: schema.projectItems.customUnit,
      ahspUnit: schema.ahspItems.unit,
      volume: schema.projectItems.volume,
      customUnitPrice: schema.projectItems.customUnitPrice,
      startWeek: schema.projectItems.startWeek,
      durationWeeks: schema.projectItems.durationWeeks,
      sortOrder: schema.projectItems.sortOrder,
    })
    .from(schema.projectItems)
    .leftJoin(
      schema.wbsItems,
      eq(schema.wbsItems.id, schema.projectItems.wbsItemId),
    )
    .leftJoin(
      schema.ahspItems,
      eq(schema.ahspItems.id, schema.projectItems.ahspItemId),
    )
    .where(eq(schema.projectItems.projectId, projectId))
    .orderBy(asc(schema.projectItems.sortOrder));

  return rows.map((r) => {
    const volume = Number(r.volume ?? 0);
    const unitPrice = Number(r.customUnitPrice ?? 0);
    return {
      id: r.id,
      wbsCode: r.wbsCode,
      wbsName: r.wbsName,
      name: r.customName ?? r.ahspName ?? "(item)",
      unit: r.customUnit ?? r.ahspUnit ?? "",
      volume,
      unitPrice,
      total: volume * unitPrice,
      startWeek: r.startWeek,
      durationWeeks: r.durationWeeks,
    };
  });
}

async function loadProgress(itemIds: string[]): Promise<ProgressEntry[]> {
  if (itemIds.length === 0) return [];
  const rows = await db
    .select({
      itemId: schema.projectItemProgress.projectItemId,
      weekNum: schema.projectItemProgress.weekNum,
      percent: schema.projectItemProgress.percentActual,
    })
    .from(schema.projectItemProgress)
    .where(inArray(schema.projectItemProgress.projectItemId, itemIds));
  return rows.map((r) => ({
    itemId: r.itemId,
    weekNum: r.weekNum,
    percent: Number(r.percent),
  }));
}

export default async function ProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const project = await loadProject(id, user.id);
  if (!project) notFound();

  const items = await loadItems(project.id);
  const progress = await loadProgress(items.map((i) => i.id));

  // Cek apakah ada item yang udah di-schedule
  const scheduled = items.filter(
    (i) => i.startWeek != null && i.durationWeeks != null,
  );
  const totalWeeks = scheduled.reduce(
    (max, it) =>
      Math.max(max, (it.startWeek ?? 0) + (it.durationWeeks ?? 0) - 1),
    0,
  );

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
            Progres Tracking
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl">
            Realisasi vs Rencana
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Input persen aktual per item per minggu. Sistem menghitung kumulatif
            rencana (dari schedule) vs realisasi, plus deviasinya. Kurva S
            otomatis tampil di bawah.
          </p>
        </header>

        {items.length === 0 ? (
          <EmptyState
            href={`/projects/${project.id}`}
            cta="halaman project"
            message="Belum ada item RAB. Tambahkan item dulu sebelum mulai tracking progres."
          />
        ) : scheduled.length === 0 ? (
          <EmptyState
            href={`/projects/${project.id}/schedule`}
            cta="halaman Schedule"
            message="Belum ada item yang di-schedule. Set minggu mulai dan durasi tiap item dulu di Schedule."
          />
        ) : (
          <ProgressEditor
            projectId={project.id}
            items={scheduled}
            initialProgress={progress}
            totalWeeks={Math.max(totalWeeks, 1)}
          />
        )}
      </section>
    </AppShell>
  );
}

function EmptyState({
  href,
  cta,
  message,
}: {
  href: string;
  cta: string;
  message: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
      {message}{" "}
      <Link href={href} className="text-accent hover:underline">
        Buka {cta}
      </Link>
      .
    </div>
  );
}
