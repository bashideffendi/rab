import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, isNull, lte, or, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
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
  // Step 1: Get all (material, total kebutuhan) by joining items × ahsp_components × materials
  const aggRows = await db
    .select({
      materialId: schema.materials.id,
      name: schema.materials.name,
      type: schema.materials.type,
      unit: schema.materials.unit,
      coefficient: schema.ahspComponents.coefficient,
      itemVolume: schema.projectItems.volume,
    })
    .from(schema.projectItems)
    .innerJoin(
      schema.ahspComponents,
      eq(
        schema.ahspComponents.ahspItemId,
        schema.projectItems.ahspItemId,
      ),
    )
    .innerJoin(
      schema.materials,
      eq(schema.materials.id, schema.ahspComponents.materialId),
    )
    .where(eq(schema.projectItems.projectId, projectId));

  // Aggregate per material
  const map = new Map<string, BreakdownRow>();
  for (const r of aggRows) {
    const koef = Number(r.coefficient);
    const vol = Number(r.itemVolume);
    if (!Number.isFinite(koef) || !Number.isFinite(vol)) continue;
    const kebutuhan = koef * vol;
    let m = map.get(r.materialId);
    if (!m) {
      m = {
        materialId: r.materialId,
        name: r.name,
        type: r.type,
        unit: r.unit,
        totalKebutuhan: 0,
        hargaSatuan: 0,
        totalBiaya: 0,
      };
      map.set(r.materialId, m);
    }
    m.totalKebutuhan += kebutuhan;
  }

  // Step 2: Get latest material price per material
  // Prefer regionId match, fallback to nasional
  if (map.size === 0) return [];
  const matIds = Array.from(map.keys());
  const today = new Date().toISOString().slice(0, 10);

  const prices = await db
    .select({
      materialId: schema.materialPrices.materialId,
      price: schema.materialPrices.price,
      regionId: schema.materialPrices.regionId,
      validFrom: schema.materialPrices.validFrom,
    })
    .from(schema.materialPrices)
    .where(
      and(
        inArray(schema.materialPrices.materialId, matIds),
        lte(schema.materialPrices.validFrom, today),
        or(
          isNull(schema.materialPrices.validTo),
          gte(schema.materialPrices.validTo, today),
        ),
      ),
    )
    .orderBy(desc(schema.materialPrices.validFrom));

  // Pick latest price per material; prefer regionId match if any
  const priceByMat = new Map<string, number>();
  for (const p of prices) {
    if (priceByMat.has(p.materialId)) continue;
    // prefer regionId match
    if (regionId && p.regionId !== regionId && p.regionId !== null) continue;
    priceByMat.set(p.materialId, Number(p.price));
  }
  // Fallback to any price for materials still missing
  for (const p of prices) {
    if (!priceByMat.has(p.materialId)) {
      priceByMat.set(p.materialId, Number(p.price));
    }
  }

  // Compute totals
  for (const m of map.values()) {
    m.hargaSatuan = priceByMat.get(m.materialId) ?? 0;
    m.totalBiaya = m.hargaSatuan * m.totalKebutuhan;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.type !== b.type) {
      const order = { tenaga: 0, bahan: 1, alat: 2 } as const;
      return order[a.type] - order[b.type];
    }
    return a.name.localeCompare(b.name);
  });
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
            <p className="text-sm font-semibold text-accent">Breakdown</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Kebutuhan Material & Tenaga
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Total agregat semua komponen dari item RAB. Berguna buat belanja
              material + estimasi kebutuhan tenaga.
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
            Belum ada item AHSP di project ini. Tambah item RAB pakai mode AHSP
            di halaman project.
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
