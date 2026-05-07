"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateItemsSchedule } from "@/app/projects/schedule-actions";
import { formatIDR } from "@/lib/utils";

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

function calcTotal(item: Item): number {
  return Number(item.volume) * Number(item.unitPrice);
}

function sortByCode(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const ap = a.split(".").map(Number);
  const bp = b.split(".").map(Number);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function ScheduleEditor({
  projectId,
  initialItems,
}: {
  projectId: string;
  initialItems: Item[];
}) {
  // Sort items by WBS code
  const sortedItems = useMemo(
    () =>
      [...initialItems].sort((a, b) => sortByCode(a.wbsCode, b.wbsCode)),
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

  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

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
              <th className="w-24 px-3 py-3 text-center">Mulai (Mg)</th>
              <th className="w-24 px-3 py-3 text-center">Durasi (Mg)</th>
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
                      placeholder="—"
                      value={e.startWeek}
                      onChange={(ev) =>
                        updateEdit(it.id, { startWeek: ev.target.value })
                      }
                      className="text-center font-mono"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="—"
                      value={e.durationWeeks}
                      onChange={(ev) =>
                        updateEdit(it.id, { durationWeeks: ev.target.value })
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
            {totalWeeks > 0 ? `${totalWeeks} minggu` : "—"}
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
              Visual timeline {totalWeeks} minggu
            </p>
          </div>
          <GanttChart
            items={sortedItems}
            edits={edits}
            totalWeeks={totalWeeks}
          />
        </div>
      )}
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
