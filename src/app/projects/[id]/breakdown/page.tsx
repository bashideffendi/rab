import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { loadBreakdownRows } from "@/lib/breakdown";
import { formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

type BreakdownRow = {
  materialId: string;
  name: string;
  type: "tenaga" | "bahan" | "alat";
  unit: string;
  totalKebutuhan: number;
  hargaSatuan: number;
  totalBiaya: number;
};

async function loadProjectMeta(id: string, userId: string) {
  const rows = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      regionId: schema.projects.regionId,
    })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

async function loadBreakdown(
  projectId: string,
  regionId: string | null,
): Promise<BreakdownRow[]> {
  // Delegasi ke helper bersama (region-aware IKK + sanity-gate) — angka sama
  // persis dgn sheet export & halaman /print, dan rekonsiliasi ke subtotal RAB.
  // Dulu fungsi ini hitung harga sendiri TANPA IKK & TANPA gate → angka beda.
  return loadBreakdownRows(projectId, regionId);
}

const TYPE_LABEL = {
  tenaga: "Tenaga / Upah",
  bahan: "Bahan / Material",
  alat: "Peralatan",
};

function formatNum(v: number): string {
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("id-ID", { maximumFractionDigits: 4 });
}

export default async function BreakdownPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const project = await loadProjectMeta(id, user.id);
  if (!project) notFound();

  const rows = await loadBreakdown(project.id, project.regionId);

  const byType = {
    tenaga: rows.filter((r) => r.type === "tenaga"),
    bahan: rows.filter((r) => r.type === "bahan"),
    alat: rows.filter((r) => r.type === "alat"),
  };
  const totals = {
    tenaga: byType.tenaga.reduce((s, r) => s + r.totalBiaya, 0),
    bahan: byType.bahan.reduce((s, r) => s + r.totalBiaya, 0),
    alat: byType.alat.reduce((s, r) => s + r.totalBiaya, 0),
  };

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm font-medium text-muted-foreground hover:text-accent"
        >
          ← {project.name}
        </Link>

        <header className="mt-2 mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Breakdown
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight">
              Kebutuhan Material & Tenaga
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Agregat seluruh komponen dari item RAB. Berguna untuk perencanaan
              belanja material dan estimasi kebutuhan tenaga kerja.
            </p>
          </div>
          <a href={`/api/projects/${project.id}/export`} download>
            <Button variant="primary" size="sm">
              ↓ Export Excel
            </Button>
          </a>
        </header>

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Belum ada item AHSP di project ini. Tambahkan item RAB
            menggunakan mode AHSP di halaman project terlebih dahulu.
          </p>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard
                label="Tenaga / Upah"
                count={byType.tenaga.length}
                total={totals.tenaga}
              />
              <KpiCard
                label="Bahan / Material"
                count={byType.bahan.length}
                total={totals.bahan}
              />
              <KpiCard
                label="Peralatan"
                count={byType.alat.length}
                total={totals.alat}
              />
            </div>

            {(["tenaga", "bahan", "alat"] as const).map((type) =>
              byType[type].length > 0 ? (
                <section key={type} className="mb-8">
                  <h2 className="mb-2 text-base font-semibold tracking-tight">
                    {TYPE_LABEL[type]}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({byType[type].length} item)
                    </span>
                  </h2>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Nama</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Total Kebutuhan
                          </th>
                          <th className="px-3 py-2 font-medium">Sat</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Harga Satuan
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            Total Biaya
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {byType[type].map((r) => (
                          <tr
                            key={r.materialId}
                            className="border-t border-border"
                          >
                            <td className="px-3 py-2">{r.name}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {formatNum(r.totalKebutuhan)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {r.unit}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {r.hargaSatuan
                                ? formatIDR(r.hargaSatuan)
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-medium tabular-nums">
                              {r.totalBiaya
                                ? formatIDR(r.totalBiaya)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30">
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-2 text-right text-sm font-medium text-muted-foreground"
                          >
                            Subtotal {TYPE_LABEL[type]}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                            {formatIDR(totals[type])}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
              ) : null,
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}

function KpiCard({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {count} <span className="text-sm font-normal text-muted-foreground">item</span>
      </p>
      <p className="mt-1 font-mono text-sm text-accent tabular-nums">
        {formatIDR(total)}
      </p>
    </div>
  );
}
