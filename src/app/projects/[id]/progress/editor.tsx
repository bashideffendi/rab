"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { updateProgress } from "../../progress-actions";

type Item = {
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

const formatIDR = (n: number) =>
  "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });

const formatPct = (n: number) =>
  `${n.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;

// Match server-side HISTORICAL_WEEK_THRESHOLD di progress-actions.ts.
// Minggu yang kurang dari currentWeek - HISTORY_THRESHOLD dianggap historical.
const HISTORY_THRESHOLD = 2;

export function ProgressEditor({
  projectId,
  projectEditHref,
  items,
  initialProgress,
  initialPlanned,
  totalWeeks,
  currentWeek,
  usingFallback,
}: {
  projectId: string;
  projectEditHref: string;
  items: Item[];
  initialProgress: ProgressEntry[];
  initialPlanned: ProgressEntry[];
  totalWeeks: number;
  currentWeek: number;
  usingFallback: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // Map: itemId -> Map<weekNum, percent>
  const [actuals, setActuals] = useState<Map<string, Map<number, number>>>(
    () => {
      const m = new Map<string, Map<number, number>>();
      for (const e of initialProgress) {
        if (!m.has(e.itemId)) m.set(e.itemId, new Map());
        m.get(e.itemId)!.set(e.weekNum, e.percent);
      }
      return m;
    },
  );

  // Subtotal project untuk hitung bobot
  const projectSubtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.total, 0),
    [items],
  );

  // Lookup: itemId → Map<weekNum, plannedPercent> (override dari DB)
  const plannedOverrides = useMemo(() => {
    const m = new Map<string, Map<number, number>>();
    for (const e of initialPlanned) {
      if (!m.has(e.itemId)) m.set(e.itemId, new Map());
      m.get(e.itemId)!.set(e.weekNum, e.percent);
    }
    return m;
  }, [initialPlanned]);

  // Per item: bobot, planned per week (override atau flat), kumulatif, actual kumulatif
  const itemMetrics = useMemo(() => {
    return items.map((it) => {
      const bobot =
        projectSubtotal > 0 ? (it.total / projectSubtotal) * 100 : 0;
      const start = it.startWeek ?? 1;
      const dur = Math.max(1, it.durationWeeks ?? 1);
      const end = start + dur - 1;
      const flatPlanned = 100 / dur;
      const overrides = plannedOverrides.get(it.id);
      const hasOverride = overrides != null && overrides.size > 0;

      // Per-minggu planned: override DB kalau ada, else flat
      function plannedAtWeek(w: number): number {
        if (w < start || w > end) return 0;
        const v = overrides?.get(w);
        return v != null ? v : flatPlanned;
      }

      const plannedCumByWeek = new Map<number, number>();
      let cum = 0;
      for (let w = 1; w <= totalWeeks; w++) {
        cum += plannedAtWeek(w);
        plannedCumByWeek.set(w, Math.min(100, cum));
      }

      const actualMap = actuals.get(it.id) ?? new Map();

      return {
        item: it,
        bobot,
        startWeek: start,
        endWeek: end,
        plannedCumByWeek,
        actualMap,
        hasOverride,
      };
    });
  }, [items, projectSubtotal, totalWeeks, actuals, plannedOverrides]);

  // Project-level cumulative per week
  const projectMetrics = useMemo(() => {
    const planned: number[] = [];
    const actual: number[] = [];
    for (let w = 1; w <= totalWeeks; w++) {
      let plannedSum = 0;
      let actualSum = 0;
      for (const m of itemMetrics) {
        const itemPlannedCum = m.plannedCumByWeek.get(w) ?? 0;
        const itemActualCum = getCumActualUntilWeek(m.actualMap, w);
        plannedSum += (m.bobot / 100) * itemPlannedCum;
        actualSum += (m.bobot / 100) * itemActualCum;
      }
      planned.push(plannedSum);
      actual.push(actualSum);
    }
    return { planned, actual };
  }, [itemMetrics, totalWeeks]);

  const currentPlanned = projectMetrics.planned[currentWeek - 1] ?? 0;
  const currentActual = projectMetrics.actual[currentWeek - 1] ?? 0;
  const deviation = currentActual - currentPlanned;

  function setActual(itemId: string, weekNum: number, percent: number) {
    setActuals((prev) => {
      const next = new Map(prev);
      const inner = new Map(next.get(itemId) ?? new Map());
      if (percent <= 0) {
        inner.delete(weekNum);
      } else {
        inner.set(weekNum, percent);
      }
      next.set(itemId, inner);
      return next;
    });
  }

  function handleSave() {
    setError(null);
    setSavedNote(null);
    const payload: ProgressEntry[] = [];
    for (const [itemId, weekMap] of actuals.entries()) {
      for (const [weekNum, percent] of weekMap.entries()) {
        payload.push({ itemId, weekNum, percent });
      }
    }
    start(async () => {
      const result = await updateProgress(projectId, JSON.stringify(payload));
      if (result.error) {
        setError(result.error);
      } else {
        const baseMsg = `Tersimpan ${result.saved ?? 0} entri.`;
        const hist = result.historicalCount ?? 0;
        setSavedNote(
          hist > 0
            ? `${baseMsg} ${hist} entri minggu lampau dicatat di audit log.`
            : baseMsg,
        );
      }
    });
  }

  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  function scrollToCurrentWeek() {
    const container = tableScrollRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(
      `[data-week="${currentWeek}"]`,
    );
    if (!target) return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset =
      target.offsetLeft - container.offsetLeft - containerRect.width / 2 +
      targetRect.width / 2;
    container.scrollTo({ left: offset, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      {usingFallback && (
        <div className="rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-foreground">
          <span className="font-semibold">Tanggal mulai belum di-set.</span>{" "}
          Minggu berjalan dihitung dari tanggal project dibuat (fallback).{" "}
          <Link
            href={projectEditHref}
            className="font-medium text-accent hover:underline"
          >
            Set Tanggal SPMK di Edit Project
          </Link>{" "}
          untuk akurasi.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <KpiCard
          label="Minggu Saat Ini"
          value={`Minggu ${currentWeek}`}
          sub={`dari total ${totalWeeks} minggu`}
        />
        <KpiCard
          label="Rencana s.d. Saat Ini"
          value={formatPct(currentPlanned)}
          tone="default"
        />
        <KpiCard
          label="Realisasi s.d. Saat Ini"
          value={formatPct(currentActual)}
          tone="accent"
        />
        <KpiCard
          label="Deviasi"
          value={formatPct(deviation)}
          tone={
            deviation < -5
              ? "danger"
              : deviation > 5
                ? "success"
                : "default"
          }
          sub={
            deviation < 0
              ? "di bawah rencana"
              : deviation > 0
                ? "di atas rencana"
                : "sesuai rencana"
          }
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={scrollToCurrentWeek}
        >
          Lompat ke Minggu {currentWeek}
        </Button>
      </div>

      {/* Editor table */}
      <div
        ref={tableScrollRef}
        className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm"
      >
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-3 text-left">
                Pekerjaan
              </th>
              <th className="px-3 py-3 text-right">Bobot</th>
              {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(
                (w) => (
                  <th
                    key={w}
                    data-week={w}
                    className={`min-w-[68px] px-2 py-3 text-center font-mono ${
                      w === currentWeek
                        ? "bg-accent/10 text-accent"
                        : w < currentWeek
                          ? "text-muted-foreground/70"
                          : ""
                    }`}
                  >
                    M{w}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {itemMetrics.map((m) => (
              <tr
                key={m.item.id}
                className="border-t border-border hover:bg-muted/20"
              >
                <td className="sticky left-0 z-10 bg-card px-3 py-2 text-left">
                  <div>
                    {m.item.wbsCode && (
                      <span className="mr-2 font-mono text-xs text-muted-foreground">
                        {m.item.wbsCode}
                      </span>
                    )}
                    <span className="text-sm font-medium">{m.item.name}</span>
                    {m.hasOverride && (
                      <span
                        className="ml-1.5 inline-flex rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent"
                        title="Bobot rencana mingguan pakai override dari Schedule"
                      >
                        kurva
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.item.volume.toLocaleString("id-ID")} {m.item.unit} ·{" "}
                    {formatIDR(m.item.total)}
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {m.bobot.toFixed(2)}%
                </td>
                {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(
                  (w) => {
                    const inSchedule =
                      w >= m.startWeek && w <= m.endWeek;
                    const actualVal = m.actualMap.get(w);
                    const isHistorical = w < currentWeek - HISTORY_THRESHOLD;
                    return (
                      <td
                        key={w}
                        className={`px-1.5 py-1.5 text-center ${
                          w === currentWeek ? "bg-accent/5" : ""
                        }`}
                      >
                        {inSchedule ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            inputMode="decimal"
                            value={actualVal ?? ""}
                            onChange={(e) =>
                              setActual(
                                m.item.id,
                                w,
                                Number(e.target.value),
                              )
                            }
                            placeholder="—"
                            title={
                              isHistorical
                                ? "Minggu sudah lewat — edit dicatat di audit log"
                                : undefined
                            }
                            className={`w-16 rounded border px-1.5 py-1 text-center font-mono text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-accent ${
                              isHistorical
                                ? "border-warning/40 bg-warning/5 text-foreground/80"
                                : "border-border bg-background focus:border-accent"
                            }`}
                          />
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground/40">
                            ·
                          </span>
                        )}
                      </td>
                    );
                  },
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Input nilai 0–100 sebagai % kumulatif per item di akhir minggu
        tersebut. Cell di luar jadwal (titik abu) tidak bisa diisi. Cell
        berwarna kuning = minggu sudah lewat lebih dari {HISTORY_THRESHOLD}{" "}
        minggu, edit dicatat di audit log.
      </p>

      {/* Kurva S */}
      <KurvaS
        totalWeeks={totalWeeks}
        planned={projectMetrics.planned}
        actual={projectMetrics.actual}
        currentWeek={currentWeek}
      />

      {/* Save bar */}
      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
        <div>
          {error && (
            <p className="text-xs font-medium text-danger">{error}</p>
          )}
          {savedNote && !error && (
            <p className="text-xs font-medium text-success">{savedNote}</p>
          )}
          {!error && !savedNote && (
            <p className="text-xs text-muted-foreground">
              Total {countEntries(actuals)} entri tercatat di {totalWeeks}{" "}
              minggu
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={pending}
          onClick={handleSave}
        >
          {pending ? "Menyimpan…" : "💾 Simpan Progres"}
        </Button>
      </div>
    </div>
  );
}

// Get cumulative actual % at end of given week
function getCumActualUntilWeek(
  actualMap: Map<number, number>,
  week: number,
): number {
  // Treat input value sebagai snapshot kumulatif di minggu tersebut.
  // Ambil nilai max dari minggu 1 s.d. `week` (assume monotonic naik).
  let maxVal = 0;
  for (const [w, val] of actualMap.entries()) {
    if (w <= week && val > maxVal) maxVal = val;
  }
  return maxVal;
}

function countEntries(actuals: Map<string, Map<number, number>>): number {
  let n = 0;
  for (const m of actuals.values()) n += m.size;
  return n;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "accent" | "danger" | "success";
}) {
  const toneClass =
    tone === "accent"
      ? "text-accent"
      : tone === "danger"
        ? "text-danger"
        : tone === "success"
          ? "text-success"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${toneClass}`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

// ─── Kurva S ──────────────────────────────────────────────────────────────

function KurvaS({
  totalWeeks,
  planned,
  actual,
  currentWeek,
}: {
  totalWeeks: number;
  planned: number[];
  actual: number[];
  currentWeek: number;
}) {
  const width = 800;
  const height = 280;
  const padX = 50;
  const padY = 30;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const xFor = (w: number) =>
    totalWeeks > 1 ? padX + ((w - 1) / (totalWeeks - 1)) * innerW : padX + innerW / 2;
  const yFor = (pct: number) => padY + innerH - (pct / 100) * innerH;

  // Smooth path for planned (line through points)
  const plannedPath = planned
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i + 1)} ${yFor(p)}`)
    .join(" ");

  // Step path for actual (only draw where data exists)
  const actualPoints = actual
    .map((a, i) => ({ x: xFor(i + 1), y: yFor(a), pct: a, week: i + 1 }))
    .filter((p) => p.pct > 0);
  const actualPath =
    actualPoints.length > 0
      ? actualPoints
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
          .join(" ")
      : "";

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Kurva S
          </p>
          <p className="text-sm font-bold tracking-tight">
            Rencana vs Realisasi (Kumulatif %)
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded bg-muted-foreground" />
            Rencana
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded bg-accent" />
            Realisasi
          </span>
        </div>
      </header>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid horizontal */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line
              x1={padX}
              x2={width - padX}
              y1={yFor(pct)}
              y2={yFor(pct)}
              className="stroke-border"
              strokeDasharray="2 3"
            />
            <text
              x={padX - 8}
              y={yFor(pct)}
              textAnchor="end"
              alignmentBaseline="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {pct}%
            </text>
          </g>
        ))}
        {/* X-axis ticks */}
        {Array.from({ length: totalWeeks }, (_, i) => i + 1)
          .filter(
            (w) =>
              totalWeeks <= 12 ||
              w === 1 ||
              w === totalWeeks ||
              w % Math.ceil(totalWeeks / 8) === 0,
          )
          .map((w) => (
            <text
              key={w}
              x={xFor(w)}
              y={height - padY + 16}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              M{w}
            </text>
          ))}
        {/* Current week marker */}
        <line
          x1={xFor(currentWeek)}
          x2={xFor(currentWeek)}
          y1={padY}
          y2={height - padY}
          className="stroke-accent/30"
          strokeDasharray="3 3"
        />
        {/* Planned line */}
        <path
          d={plannedPath}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth="2"
        />
        {/* Actual line */}
        {actualPath && (
          <path
            d={actualPath}
            fill="none"
            className="stroke-accent"
            strokeWidth="2.5"
          />
        )}
        {/* Actual points */}
        {actualPoints.map((p) => (
          <circle
            key={p.week}
            cx={p.x}
            cy={p.y}
            r="3.5"
            className="fill-accent"
          />
        ))}
      </svg>
    </div>
  );
}
