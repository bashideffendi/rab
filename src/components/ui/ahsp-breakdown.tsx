"use client";

import { useEffect, useState } from "react";

type Component = {
  materialId: string;
  materialCode: string;
  materialName: string;
  materialType: "bahan" | "tenaga" | "alat" | string;
  unit: string;
  coefficient: number;
  qty: number;
  unitPrice: number;
  unitPriceAdjusted: number;
  lineTotal: number;
  priceMissing: boolean;
};

type BreakdownData = {
  ahsp: {
    id: string;
    code: string;
    name: string;
    unit: string;
    sourceDoc: string | null;
  };
  volume: number;
  region: {
    id: string | null;
    name: string | null;
    ikk: string | null;
    multiplier: number;
  };
  components: Component[];
  byType: {
    bahan: Component[];
    tenaga: Component[];
    alat: Component[];
  };
  subtotal: number;
  unitPrice: number;
  missingMaterials: string[];
};

const formatIDR = (n: number) =>
  "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });

const formatNum = (n: number, decimals = 4) =>
  n.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

const TYPE_LABELS: Record<string, string> = {
  bahan: "Bahan / Material",
  tenaga: "Tenaga / Upah",
  alat: "Peralatan",
};

const TYPE_ICONS: Record<string, string> = {
  bahan: "🧱",
  tenaga: "👷",
  alat: "🔧",
};

/**
 * AhspBreakdown — tabel detail komponen AHSP × volume × harga.
 *
 * Tampil saat user pilih AHSP item dan input volume.
 * Auto-fetch dari /api/ahsp/[id]/breakdown saat ahspId / volume / regionId
 * berubah. Debounced 400ms biar gak spam request waktu volume diketik.
 */
export function AhspBreakdown({
  ahspId,
  volume,
  regionId,
}: {
  ahspId: string;
  volume: number;
  regionId: string | null;
}) {
  const [data, setData] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ahspId || !Number.isFinite(volume) || volume <= 0) {
      setData(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("volume", String(volume));
        if (regionId) params.set("regionId", regionId);
        const res = await fetch(
          `/api/ahsp/${ahspId}/breakdown?${params.toString()}`,
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Gagal load breakdown");
        }
        const json: BreakdownData = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Gagal load breakdown");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ahspId, volume, regionId]);

  if (!ahspId || volume <= 0) return null;

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground shadow-sm">
        Memuat breakdown komponen…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!data) return null;

  if (data.components.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        AHSP ini belum punya komponen ter-detail di database.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Hasil — Analisis Harga Satuan
            </p>
            <h3 className="mt-1 text-sm font-bold tracking-tight">
              {data.ahsp.code}
              {data.ahsp.name ? ` · ${data.ahsp.name}` : ""}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {data.ahsp.sourceDoc && (
                <span className="font-mono">{data.ahsp.sourceDoc}</span>
              )}
              {data.region.ikk && (
                <span className="ml-2">
                  · IKK {data.region.name}: {data.region.ikk}{" "}
                  <span className="text-muted-foreground/70">
                    (×{data.region.multiplier.toFixed(4)})
                  </span>
                </span>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Volume
            </p>
            <p className="font-mono text-base font-bold tabular-nums">
              {formatNum(data.volume, 3)}{" "}
              <span className="text-xs text-muted-foreground">
                {data.ahsp.unit}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Components table by type */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Komponen</th>
              <th className="px-2 py-2 text-right">Koef</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-left">Sat</th>
              <th className="px-2 py-2 text-right">Harga Sat</th>
              <th className="px-3 py-2 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {(["bahan", "tenaga", "alat"] as const).map((type) => {
              const rows = data.byType[type];
              if (rows.length === 0) return null;
              const groupSubtotal = rows.reduce(
                (s, r) => s + r.lineTotal,
                0,
              );
              return (
                <GroupRows
                  key={type}
                  label={TYPE_LABELS[type]}
                  icon={TYPE_ICONS[type]}
                  rows={rows}
                  subtotal={groupSubtotal}
                />
              );
            })}
          </tbody>
          <tfoot className="bg-accent/5 font-bold">
            <tr className="border-t-2 border-accent/30">
              <td colSpan={4} className="px-3 py-2.5 text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Harga Satuan ({data.ahsp.unit})
                </span>
              </td>
              <td className="px-2 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                {formatIDR(data.unitPrice)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-accent">
                {formatIDR(data.subtotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Missing materials warning */}
      {data.missingMaterials.length > 0 && (
        <div className="border-t border-warning/40 bg-warning/5 px-4 py-2.5 text-xs text-warning">
          <strong>⚠ {data.missingMaterials.length} material belum ada harga:</strong>{" "}
          {data.missingMaterials.slice(0, 5).join(", ")}
          {data.missingMaterials.length > 5 &&
            ` (+${data.missingMaterials.length - 5} lainnya)`}
          {" — "}line ini gak masuk total, harga unit under-estimated.
        </div>
      )}
    </div>
  );
}

function GroupRows({
  label,
  icon,
  rows,
  subtotal,
}: {
  label: string;
  icon: string;
  rows: Component[];
  subtotal: number;
}) {
  return (
    <>
      <tr className="border-t border-border bg-muted/20">
        <td colSpan={6} className="px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {icon} {label} · {rows.length} item
          </span>
        </td>
      </tr>
      {rows.map((r) => (
        <tr
          key={r.materialId}
          className={`border-t border-border ${r.priceMissing ? "bg-warning/5" : ""}`}
        >
          <td className="px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">
                {r.materialCode}
              </span>
              <span className="text-xs">{r.materialName}</span>
              {r.priceMissing && (
                <span
                  className="rounded border border-warning/40 bg-warning/10 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-warning"
                  title="Harga material belum tersedia di database"
                >
                  no price
                </span>
              )}
            </div>
          </td>
          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
            {formatNum(r.coefficient, 4)}
          </td>
          <td className="px-2 py-1.5 text-right font-mono tabular-nums">
            {formatNum(r.qty, 3)}
          </td>
          <td className="px-2 py-1.5 text-muted-foreground">{r.unit}</td>
          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
            {r.priceMissing ? "—" : formatIDR(r.unitPriceAdjusted)}
          </td>
          <td className="px-3 py-1.5 text-right font-mono font-medium tabular-nums">
            {r.priceMissing ? "—" : formatIDR(r.lineTotal)}
          </td>
        </tr>
      ))}
      <tr className="border-t border-border/50 bg-muted/10">
        <td colSpan={5} className="px-3 py-1 text-right">
          <span className="text-[10px] font-medium text-muted-foreground">
            Sub-{label.split(" ")[0].toLowerCase()}
          </span>
        </td>
        <td className="px-3 py-1 text-right font-mono text-xs font-semibold tabular-nums text-muted-foreground">
          {formatIDR(subtotal)}
        </td>
      </tr>
    </>
  );
}
