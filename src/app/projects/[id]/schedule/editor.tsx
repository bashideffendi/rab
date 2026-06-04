"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateItemsSchedule,
  updatePlannedDistribution,
} from "@/app/projects/schedule-actions";
import { getPeriodConfig, type ProgressPeriod } from "@/lib/period";
import { compareWbsCode, formatIDR } from "@/lib/utils";

type Item = {
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

type ItemEdit = {
  startWeek: string; // "" = unset
  durationWeeks: string;
};

type PlannedEntry = {
  itemId: string;
  weekNum: number;
  percent: number;
};

function calcTotal(item: Item): number {
  return Number(item.volume) * Number(item.unitPrice);
}

// Cap input minggu di 520 (~10 tahun) biar table gak meledak kalau user
// ngetik angka raksasa. Empty string lewat (user belum input).
function clampStr(raw: string, min: number, max: number): string {
  if (raw === "") return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return String(Math.max(min, Math.min(max, Math.floor(n))));
}


export function ScheduleEditor({
  projectId,
  initialItems,
  initialPlanned,
  periodType = "weekly",
}: {
  projectId: string;
  initialItems: Item[];
  initialPlanned: PlannedEntry[];
  periodType?: ProgressPeriod;
}) {
  const periodConfig = getPeriodConfig(periodType);
  // Sort items by WBS code
  const sortedItems = useMemo(
    () =>
      [...initialItems].sort((a, b) => compareWbsCode(a.wbsCode, b.wbsCode)),
    [initialItems],
  );

  // Per-item editable state
  const [edits, setEdits] = useState<Map<string, ItemEdit>>(() => {
    const m = new Map<string, ItemEdit>();
    for (const it of sortedItems) {
      m.set(it.id, {
        startWeek: it.startWeek?.toString() ?? "",
        durationWeeks: it.durationWeeks?.toString() ?? "",
      });
    }
    return m;
  });

  // Planned distribution state (override flat). Map<itemId, Map<weekNum, percent>>.
  // Kalau item gak ada di Map → pakai flat default (100/durasi).
  const [planned, setPlanned] = useState<Map<string, Map<number, number>>>(
    () => {
      const m = new Map<string, Map<number, number>>();
      for (const e of initialPlanned) {
        if (!m.has(e.itemId)) m.set(e.itemId, new Map());
        m.get(e.itemId)!.set(e.weekNum, e.percent);
      }
      return m;
    },
  );

  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [plannedPending, startPlannedTransition] = useTransition();
  const [plannedSaved, setPlannedSaved] = useState(false);
  const [plannedError, setPlannedError] = useState<string | null>(null);

  // Compute project subtotal & per-item bobot
  const subtotal = useMemo(
    () => sortedItems.reduce((s, it) => s + calcTotal(it), 0),
    [sortedItems],
  );

  const totalWeeks = useMemo(() => {
    let max = 0;
    for (const it of sortedItems) {
      const e = edits.get(it.id);
      const start = Number(e?.startWeek);
      const dur = Number(e?.durationWeeks);
      if (Number.isFinite(start) && Number.isFinite(dur) && start > 0 && dur > 0) {
        max = Math.max(max, start + dur - 1);
      }
    }
    return max;
  }, [sortedItems, edits]);

  function updateEdit(itemId: string, patch: Partial<ItemEdit>) {
    setEdits((prev) => {
      const next = new Map(prev);
      const cur = next.get(itemId) ?? { startWeek: "", durationWeeks: "" };
      next.set(itemId, { ...cur, ...patch });
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    const payload = Array.from(edits.entries()).map(([itemId, e]) => ({
      itemId,
      startWeek: e.startWeek ? Number(e.startWeek) : null,
      durationWeeks: e.durationWeeks ? Number(e.durationWeeks) : null,
    }));

    const fd = new FormData();
    fd.append("projectId", projectId);
    fd.append("payload", JSON.stringify(payload));

    startTransition(() => {
      updateItemsSchedule(fd).then(() => setSaved(true));
    });
  }

  function setPlannedCell(
    itemId: string,
    weekNum: number,
    percent: number,
  ) {
    setPlanned((prev) => {
      const next = new Map(prev);
      const inner = new Map(next.get(itemId) ?? new Map());
      if (percent <= 0) {
        inner.delete(weekNum);
      } else {
        inner.set(weekNum, percent);
      }
      if (inner.size === 0) {
        next.delete(itemId);
      } else {
        next.set(itemId, inner);
      }
      return next;
    });
    setPlannedSaved(false);
    setPlannedError(null);
  }

  function handlePlannedSave() {
    setPlannedSaved(false);
    setPlannedError(null);

    // Gate SCH-04: bobot di-build dari window [start, start+dur) IN-MEMORY, tapi
    // start/dur baru ke-DB lewat tombol LAIN ("Simpan Schedule"). Kalau ada
    // perubahan schedule yang belum di-commit, bobot bisa tersimpan ke minggu di
    // luar durasi DB (diabaikan/orphan saat render). Paksa simpan schedule dulu.
    const norm = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const scheduleDirty = sortedItems.some((it) => {
      const e = edits.get(it.id);
      return (
        norm(e?.startWeek) !== norm(it.startWeek) ||
        norm(e?.durationWeeks) !== norm(it.durationWeeks)
      );
    });
    if (scheduleDirty) {
      setPlannedError(
        "Ada perubahan jadwal (minggu mulai/durasi) yang belum disimpan. Klik 'Simpan Schedule' dulu — bobot rencana harus nyambung dengan durasi yang sudah ke-commit.",
      );
      return;
    }

    const payload: PlannedEntry[] = [];
    const sumByItem = new Map<string, number>();
    for (const it of sortedItems) {
      const e = edits.get(it.id);
      const start = Number(e?.startWeek);
      const dur = Number(e?.durationWeeks);
      if (!Number.isFinite(start) || !Number.isFinite(dur) || start <= 0 || dur <= 0) {
        continue;
      }
      const inner = planned.get(it.id);
      if (!inner || inner.size === 0) continue; // belum di-override → flat default
      let sum = 0;
      for (let w = start; w < start + dur; w++) {
        const v = inner.get(w);
        if (v != null) {
          payload.push({ itemId: it.id, weekNum: w, percent: v });
          sum += v;
        }
      }
      sumByItem.set(it.id, sum);
    }

    // Gate: tiap item yang di-override WAJIB Σ bobot ≈ 100% (toleransi 0,5) —
    // cegah simpan distribusi yang gak nutup 100% / kebablasan.
    const bad = [...sumByItem.entries()].filter(
      ([, s]) => Math.abs(s - 100) >= 0.5,
    );
    if (bad.length > 0) {
      setPlannedError(
        `${bad.length} item: total bobot rencana ≠ 100% (mis. ${bad[0][1].toLocaleString("id-ID", { maximumFractionDigits: 1 })}%). Lengkapi sampai 100% atau kosongkan semua cell item itu (pakai flat default).`,
      );
      return;
    }

    startPlannedTransition(async () => {
      const result = await updatePlannedDistribution(
        projectId,
        JSON.stringify(payload),
      );
      if (result.error) setPlannedError(result.error);
      else setPlannedSaved(true);
    });
  }

  // Bobot per minggu: kalau item PUNYA override (≥1 cell), minggu tanpa override
  // = 0 (bukan flat) — biar Σ yang ditampilkan == Σ yang disimpan, gak ganda.
  // Flat default cuma utk item yang BELUM disentuh sama sekali.
  function getPlannedFor(itemId: string, weekNum: number, dur: number): number {
    const m = planned.get(itemId);
    if (m && m.size > 0) return m.get(weekNum) ?? 0;
    return dur > 0 ? 100 / dur : 0;
  }

  return (
    <div className="space-y-6">
      {/* === Editor Table === */}
      <div className="overflow-x-auto rounded-md border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3">WBS</th>
              <th className="px-3 py-3">Pekerjaan</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3 text-right">Bobot %</th>
              <th className="w-24 px-3 py-3 text-center">
                Mulai ({periodConfig.abbrev})
              </th>
              <th className="w-24 px-3 py-3 text-center">
                Durasi ({periodConfig.abbrev})
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((it) => {
              const total = calcTotal(it);
              const bobot = subtotal > 0 ? (total / subtotal) * 100 : 0;
              const e = edits.get(it.id) ?? {
                startWeek: "",
                durationWeeks: "",
              };
              return (
                <tr key={it.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {it.wbsCode ?? "—"}
                  </td>
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatIDR(total)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {bobot.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="1"
                      max="520"
                      placeholder="—"
                      value={e.startWeek}
                      onChange={(ev) =>
                        updateEdit(it.id, { startWeek: clampStr(ev.target.value, 1, 520) })
                      }
                      className="text-center font-mono"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="1"
                      max="520"
                      placeholder="—"
                      value={e.durationWeeks}
                      onChange={(ev) =>
                        updateEdit(it.id, { durationWeeks: clampStr(ev.target.value, 1, 520) })
                      }
                      className="text-center font-mono"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* === Save Bar === */}
      <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 shadow-md">
        <div className="text-sm">
          <span className="text-muted-foreground">Total durasi project: </span>
          <strong className="text-foreground">
            {totalWeeks > 0
              ? `${totalWeeks} ${periodConfig.pluralLower}`
              : "—"}
          </strong>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-xs text-success">✓ Tersimpan</span>
          )}
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={pending}
          >
            {pending ? "Menyimpan…" : "Simpan Schedule"}
          </Button>
        </div>
      </div>

      {/* === Gantt Chart === */}
      {totalWeeks > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-base font-semibold">Gantt Chart</h3>
            <p className="text-xs text-muted-foreground">
              Visual timeline {totalWeeks} {periodConfig.pluralLower}
            </p>
          </div>
          <GanttChart
            items={sortedItems}
            edits={edits}
            totalWeeks={totalWeeks}
          />
        </div>
      )}

      {/* === Distribusi Bobot Mingguan (Opsional) === */}
      {totalWeeks > 0 && (
        <details className="rounded-md border border-border bg-card shadow-sm">
          <summary className="cursor-pointer border-b border-border px-4 py-3 text-sm font-semibold hover:bg-muted/30">
            Distribusi Bobot per {periodConfig.label}{" "}
            <span className="font-normal text-muted-foreground">
              — Opsional, default flat (100% ÷ durasi). Override per{" "}
              {periodConfig.pluralLower} kalau laporan kontraktor pake kurva
              non-linier.
            </span>
          </summary>
          <PlannedMatrix
            items={sortedItems}
            edits={edits}
            planned={planned}
            totalWeeks={totalWeeks}
            getPlannedFor={getPlannedFor}
            onCellChange={setPlannedCell}
            abbrev={periodConfig.abbrev}
          />
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <div className="text-xs">
              {plannedError && (
                <span className="font-medium text-danger">{plannedError}</span>
              )}
              {plannedSaved && !plannedError && (
                <span className="font-medium text-success">
                  ✓ Bobot {periodConfig.pluralLower} tersimpan
                </span>
              )}
              {!plannedError && !plannedSaved && (
                <span className="text-muted-foreground">
                  Total bobot tiap item harus 100%. Kosongin = pakai default
                  flat.
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePlannedSave}
              disabled={plannedPending}
            >
              {plannedPending
                ? "Menyimpan…"
                : `Simpan Bobot ${periodConfig.label}`}
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}

function PlannedMatrix({
  items,
  edits,
  planned,
  totalWeeks,
  getPlannedFor,
  onCellChange,
  abbrev,
}: {
  items: Item[];
  edits: Map<string, ItemEdit>;
  planned: Map<string, Map<number, number>>;
  totalWeeks: number;
  getPlannedFor: (itemId: string, weekNum: number, dur: number) => number;
  onCellChange: (itemId: string, weekNum: number, percent: number) => void;
  abbrev: string;
}) {
  const scheduled = items.filter((it) => {
    const e = edits.get(it.id);
    const start = Number(e?.startWeek);
    const dur = Number(e?.durationWeeks);
    return (
      Number.isFinite(start) &&
      Number.isFinite(dur) &&
      start > 0 &&
      dur > 0
    );
  });

  if (scheduled.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground italic">
        Belum ada item dengan Mulai &amp; Durasi yang valid.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card px-2 py-2 text-left">
              Pekerjaan
            </th>
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
              <th
                key={w}
                className="min-w-[64px] px-1 py-2 text-center font-mono"
              >
                {abbrev}{w}
              </th>
            ))}
            <th className="min-w-[64px] px-2 py-2 text-right font-mono">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {scheduled.map((it) => {
            const e = edits.get(it.id)!;
            const start = Number(e.startWeek);
            const dur = Number(e.durationWeeks);
            const hasOverride = planned.has(it.id);
            let rowSum = 0;
            const cells = Array.from({ length: totalWeeks }, (_, i) => i + 1).map(
              (w) => {
                if (w < start || w >= start + dur) {
                  return (
                    <td key={w} className="px-1 py-1 text-center">
                      <span className="font-mono text-muted-foreground/30">
                        ·
                      </span>
                    </td>
                  );
                }
                const value = getPlannedFor(it.id, w, dur);
                rowSum += value;
                const isOverride = planned.get(it.id)?.has(w);
                return (
                  <td key={w} className="px-1 py-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      inputMode="decimal"
                      value={value.toFixed(2)}
                      onChange={(ev) =>
                        onCellChange(it.id, w, Number(ev.target.value))
                      }
                      className={`w-14 rounded border px-1 py-0.5 text-center font-mono text-[11px] tabular-nums focus:outline-none focus:ring-1 focus:ring-accent ${
                        isOverride
                          ? "border-accent/40 bg-accent-soft text-accent"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    />
                  </td>
                );
              },
            );
            const sumOk = Math.abs(rowSum - 100) < 0.5;
            return (
              <tr key={it.id} className="border-t border-border/50">
                <td className="sticky left-0 z-10 bg-card px-2 py-1 text-left">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {it.wbsCode}
                  </span>{" "}
                  <span className="text-xs">{it.name}</span>
                  {hasOverride && (
                    <span className="ml-1.5 inline-flex rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
                      override
                    </span>
                  )}
                </td>
                {cells}
                <td
                  className={`px-2 py-1 text-right font-mono text-[11px] tabular-nums ${
                    sumOk
                      ? "text-success"
                      : rowSum > 100
                        ? "text-danger"
                        : "text-warning"
                  }`}
                >
                  {rowSum.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GanttChart({
  items,
  edits,
  totalWeeks,
}: {
  items: Item[];
  edits: Map<string, ItemEdit>;
  totalWeeks: number;
}) {
  // Filter only items with valid schedule
  const scheduled = items.filter((it) => {
    const e = edits.get(it.id);
    const start = Number(e?.startWeek);
    const dur = Number(e?.durationWeeks);
    return (
      Number.isFinite(start) &&
      Number.isFinite(dur) &&
      start > 0 &&
      dur > 0
    );
  });

  if (scheduled.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground italic">
        Atur Mulai &amp; Durasi di tabel atas untuk render bar Gantt.
      </div>
    );
  }

  // Generate week labels
  const weekLabels = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto p-4">
      <div className="min-w-fit">
        {/* Header row: week labels */}
        <div
          className="grid border-b border-border pb-1 text-[10px] font-mono text-muted-foreground"
          style={{
            gridTemplateColumns: `300px repeat(${totalWeeks}, minmax(28px, 1fr))`,
          }}
        >
          <div className="px-2 font-semibold">Pekerjaan</div>
          {weekLabels.map((w) => (
            <div
              key={w}
              className="border-l border-border text-center font-semibold"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Rows: per item */}
        {scheduled.map((it) => {
          const e = edits.get(it.id)!;
          const start = Number(e.startWeek);
          const dur = Number(e.durationWeeks);
          return (
            <div
              key={it.id}
              className="grid items-center border-b border-border/50 py-1.5 text-xs hover:bg-muted/30"
              style={{
                gridTemplateColumns: `300px repeat(${totalWeeks}, minmax(28px, 1fr))`,
              }}
            >
              <div className="truncate px-2 pr-3">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {it.wbsCode}
                </span>{" "}
                <span>{it.name}</span>
              </div>
              {weekLabels.map((w) => {
                const isActive = w >= start && w < start + dur;
                return (
                  <div
                    key={w}
                    className="relative h-6 border-l border-border/30"
                  >
                    {isActive && (
                      <div
                        className={`absolute inset-y-1 ${
                          w === start ? "left-1 rounded-l" : "left-0"
                        } ${
                          w === start + dur - 1 ? "right-1 rounded-r" : "right-0"
                        } bg-accent`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
