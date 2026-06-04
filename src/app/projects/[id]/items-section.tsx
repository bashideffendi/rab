import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import Link from "next/link";
import { ItemAddForm } from "./item-add-form";
import { StageButton } from "./stage-button";
import { ItemsTableBody } from "./items-table-body";
import { compareWbsCode, formatIDR } from "@/lib/utils";
import { terbilangRupiah } from "@/lib/terbilang";
import { computeRekap, BASIS_REGULASI } from "@/lib/rekap";

type ItemRow = {
  id: string;
  wbsCode: string | null;
  wbsName: string | null;
  name: string;
  unit: string;
  volume: string;
  unitPrice: string;
  ahspCode: string | null;
  ahspSourceDoc: string | null;
  ahspSourceModule: string | null;
  ahspSourceSection: string | null;
  volumeFormula: string | null;
  notes: string | null;
};

type WbsOption = {
  id: string;
  code: string;
  name: string;
};

export type AhspOption = {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string;
};

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
      ahspCode: schema.ahspItems.code,
      ahspSourceDoc: schema.ahspItems.sourceDoc,
      ahspSourceModule: schema.ahspItems.sourceModule,
      ahspSourceSection: schema.ahspItems.sourceSection,
      volumeFormula: schema.projectItems.volumeFormula,
      notes: schema.projectItems.notes,
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

  return rows.map((r) => ({
    id: r.id,
    wbsCode: r.wbsCode,
    wbsName: r.wbsName,
    name: r.customName ?? "(custom item)",
    unit: r.customUnit ?? "",
    volume: r.volume,
    unitPrice: r.customUnitPrice ?? "0",
    ahspCode: r.ahspCode,
    ahspSourceDoc: r.ahspSourceDoc,
    ahspSourceModule: r.ahspSourceModule,
    ahspSourceSection: r.ahspSourceSection,
    volumeFormula: r.volumeFormula,
    notes: r.notes,
  }));
}

async function loadWbsOptions(projectId: string): Promise<WbsOption[]> {
  const rows = await db
    .select({
      id: schema.wbsItems.id,
      code: schema.wbsItems.code,
      name: schema.wbsItems.name,
    })
    .from(schema.wbsItems)
    .where(eq(schema.wbsItems.projectId, projectId));
  return rows.sort((a, b) => compareWbsCode(a.code, b.code));
}

// Removed loadAhspOptions — replaced by searchable AhspPicker yang pakai
// /api/ahsp/search endpoint. Save ~250KB payload per page load karena
// gak perlu ship 2,669 entries ke client.

function calcTotal(volume: string, unitPrice: string): number {
  const v = Number(volume);
  const p = Number(unitPrice);
  if (!Number.isFinite(v) || !Number.isFinite(p)) return 0;
  return v * p;
}

type Group = {
  wbsCode: string | null;
  wbsName: string | null;
  items: ItemRow[];
  subtotal: number;
};

function groupByWbs(items: ItemRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const key = it.wbsCode ?? "__no_wbs__";
    let g = map.get(key);
    if (!g) {
      g = {
        wbsCode: it.wbsCode,
        wbsName: it.wbsName,
        items: [],
        subtotal: 0,
      };
      map.set(key, g);
    }
    g.items.push(it);
    g.subtotal += calcTotal(it.volume, it.unitPrice);
  }
  return Array.from(map.values()).sort((a, b) =>
    compareWbsCode(a.wbsCode, b.wbsCode),
  );
}

type MatAgg = {
  ahspCode: string;
  name: string;
  unit: string;
  vol: number;
  total: number;
  count: number;
};

/** Agregasi item per-kode-AHSP lintas WBS/stage — cross-check kuantitas kalau 1
 *  AHSP dipakai di beberapa baris/divisi (mis. beton K-225 di sloof+kolom+balok,
 *  atau pasang bata di banyak ruang). Read-only, tidak mengubah total RAB. */
function aggregateByAhsp(items: ItemRow[]): MatAgg[] {
  const map = new Map<string, MatAgg>();
  for (const it of items) {
    if (!it.ahspCode) continue; // custom item tanpa AHSP → skip
    const v = Number(it.volume) || 0;
    const total = calcTotal(it.volume, it.unitPrice);
    const cur = map.get(it.ahspCode);
    if (cur) {
      cur.vol += v;
      cur.total += total;
      cur.count += 1;
    } else {
      map.set(it.ahspCode, {
        ahspCode: it.ahspCode,
        name: it.name,
        unit: it.unit,
        vol: v,
        total,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export async function ItemsSection({
  projectId,
  ppnPercent,
  overheadPercent,
  smkkPercent,
  dibulatkanKe,
  regionId = null,
}: {
  projectId: string;
  ppnPercent: string;
  overheadPercent: string;
  smkkPercent: string;
  dibulatkanKe: number;
  regionId?: string | null;
}) {
  let items: ItemRow[] = [];
  let wbsOptions: WbsOption[] = [];
  let dbError: string | null = null;
  try {
    [items, wbsOptions] = await Promise.all([
      loadItems(projectId),
      loadWbsOptions(projectId),
    ]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Gagal load items.";
  }

  const groups = groupByWbs(items);
  const subtotal = groups.reduce((sum, g) => sum + g.subtotal, 0);
  const { overheadPct, overhead, smkkPct, smkk, ppnPct, ppn, total, dibulatkan } =
    computeRekap(subtotal, {
      overheadPercent,
      smkkPercent,
      ppnPercent,
      dibulatkanKe,
    });
  const terbilang = items.length > 0 ? terbilangRupiah(dibulatkan) : "";

  return (
    <section className="mt-12">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Item RAB
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">
            Daftar Pekerjaan
          </h2>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total Dibulatkan
          </p>
          <p className="font-mono text-lg font-bold tabular-nums text-foreground">
            {formatIDR(items.length > 0 ? dibulatkan : 0)}
          </p>
        </div>
      </header>

      {dbError ? (
        <div className="mb-4 rounded border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
          {dbError}
        </div>
      ) : items.length === 0 ? (
        <p className="mb-4 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada item RAB. Tambahkan pekerjaan pertama melalui form di
          bawah.
        </p>
      ) : (
        <div className="mb-4 overflow-x-auto rounded-md border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold">Pekerjaan</th>
                <th className="px-3 py-3 text-right font-semibold">Volume</th>
                <th className="px-3 py-3 font-semibold">Sat</th>
                <th className="px-3 py-3 text-right font-semibold">Harga Sat</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="w-20 px-3 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <ItemsTableBody projectId={projectId} groups={groups} />
            </tbody>
            <tfoot className="bg-muted/40 text-sm">
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-2 text-right text-muted-foreground"
                >
                  Subtotal
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatIDR(subtotal)}
                </td>
                <td></td>
              </tr>
              {overheadPct > 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-right text-muted-foreground"
                  >
                    Overhead ({overheadPct}%)
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatIDR(overhead)}
                  </td>
                  <td></td>
                </tr>
              )}
              {smkkPct > 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-right text-muted-foreground"
                  >
                    SMKK ({smkkPct}%)
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatIDR(smkk)}
                  </td>
                  <td></td>
                </tr>
              )}
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-2 text-right text-muted-foreground"
                >
                  PPN ({ppnPct}%)
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatIDR(ppn)}
                </td>
                <td></td>
              </tr>
              <tr className="border-t border-border">
                <td
                  colSpan={4}
                  className="px-3 py-2 text-right text-sm text-muted-foreground"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatIDR(total)}
                </td>
                <td></td>
              </tr>
              <tr className="border-t border-border bg-accent/5">
                <td
                  colSpan={4}
                  className="px-3 py-3 text-right font-semibold text-foreground"
                >
                  Total dibulatkan
                </td>
                <td className="px-3 py-3 text-right font-mono text-base font-semibold tabular-nums text-accent">
                  {formatIDR(dibulatkan)}
                </td>
                <td></td>
              </tr>
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-2 text-right text-xs italic text-muted-foreground"
                >
                  Terbilang: <span className="not-italic">{terbilang}</span>
                </td>
              </tr>
              <tr>
                <td
                  colSpan={6}
                  className="px-3 pb-2 text-right text-[10px] text-muted-foreground"
                >
                  {BASIS_REGULASI}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Rekap material per-AHSP lintas-stage (B3) — hanya kalau ada AHSP dobel */}
      {items.length > 0 &&
        (() => {
          const dup = aggregateByAhsp(items).filter((m) => m.count > 1);
          if (dup.length === 0) return null;
          return (
            <details className="mb-6 rounded-md border border-border bg-card">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
                Rekap Material per-AHSP (lintas-stage) — {dup.length} AHSP
                dipakai di &gt;1 baris
              </summary>
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Kode</th>
                      <th className="px-3 py-2 font-semibold">Pekerjaan</th>
                      <th className="px-3 py-2 text-center font-semibold">
                        Baris
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Σ Volume
                      </th>
                      <th className="px-3 py-2 font-semibold">Sat</th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Σ Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dup.map((m) => (
                      <tr key={m.ahspCode} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono text-[11px] text-accent">
                          {m.ahspCode}
                        </td>
                        <td className="px-3 py-1.5">{m.name}</td>
                        <td className="px-3 py-1.5 text-center font-mono tabular-nums text-muted-foreground">
                          {m.count}×
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                          {m.vol.toLocaleString("id-ID", {
                            maximumFractionDigits: 3,
                          })}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {m.unit}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                          {formatIDR(m.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2 text-[10px] text-muted-foreground">
                Informatif (cross-check kuantitas agregat) — tidak mengubah
                tabel atau total di atas.
              </p>
            </details>
          );
        })()}

      {/* Stage Calculator + Single Item form */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          💡 <strong className="text-foreground">Tahap (Multi-Item)</strong>:
          input dimensi sekali → 4-5 items langsung masuk RAB. Cocok untuk
          Persiapan, Pondasi, dst.{" "}
          <strong className="text-foreground">Single Item</strong>:
          tambah 1 item presisi.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/excel-import`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            ⬆ Import Excel
          </Link>
          <StageButton projectId={projectId} wbsOptions={wbsOptions} />
        </div>
      </div>

      <ItemAddForm
        projectId={projectId}
        wbsOptions={wbsOptions}
        regionId={regionId}
      />
    </section>
  );
}

