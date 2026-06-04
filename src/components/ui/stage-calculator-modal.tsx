"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "./button";
import {
  STAGE_CALCULATORS,
  getStage,
  type StageItemDef,
} from "@/lib/stage-calculators";
import type { CalcInputDef } from "@/lib/volume-calculators";
import { createBulkProjectItems } from "@/app/projects/stage-actions";

type AhspMatch = {
  id: string;
  code: string;
  name: string;
  unit: string;
  sourceDoc?: string | null;
};

type SubItemState = {
  enabled: boolean;
  ahsp: AhspMatch | null;
  loadingAhsp: boolean;
  searchOverride: string; // text user buat search override
  showSearch: boolean;
  searchResults: AhspMatch[]; // hasil pencarian manual untuk dipilih user
};

type WbsOption = { id: string; code: string; name: string };

const formatNum = (n: number, d = 2) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: d });

/** Resolve ahspKeyword — boleh string statis atau fungsi dari inputs (mis.
 *  mutu beton dinamis K→f'c). */
function kwOf(it: StageItemDef, inputs: Record<string, number>): string {
  return typeof it.ahspKeyword === "function"
    ? it.ahspKeyword(inputs)
    : it.ahspKeyword;
}

export function StageCalculatorModal({
  open,
  projectId,
  wbsOptions,
  onClose,
  onSuccess,
}: {
  open: boolean;
  projectId: string;
  wbsOptions: WbsOption[];
  onClose: () => void;
  onSuccess: (created: number, warnings?: string[]) => void;
}) {
  const [stageType, setStageType] = useState<string>(
    STAGE_CALCULATORS[0]?.type ?? "",
  );
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [wbsItemId, setWbsItemId] = useState<string>("");
  const [subItems, setSubItems] = useState<Record<string, SubItemState>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const stage = useMemo(() => getStage(stageType), [stageType]);

  // Reset saat stage berubah atau modal dibuka
  useEffect(() => {
    if (!open || !stage) return;
    // Initialize inputs dengan defaults
    const initInputs: Record<string, number> = {};
    for (const inp of stage.inputs) {
      initInputs[inp.key] = inp.default ?? 0;
    }
    setInputs(initInputs);
    // Initialize sub-items state
    const initSubs: Record<string, SubItemState> = {};
    for (const it of stage.items) {
      initSubs[it.key] = {
        enabled: it.defaultEnabled,
        ahsp: null,
        loadingAhsp: true,
        searchOverride: "",
        showSearch: false,
        searchResults: [],
      };
    }
    setSubItems(initSubs);
    setError(null);
  }, [open, stageType, stage]);

  // Auto-fetch AHSP for each enabled sub-item
  useEffect(() => {
    if (!open || !stage) return;
    let cancelled = false;
    (async () => {
      for (const it of stage.items) {
        const state = subItems[it.key];
        if (!state || state.ahsp) continue;
        try {
          const res = await fetch(
            `/api/ahsp/search?q=${encodeURIComponent(kwOf(it, inputs))}&limit=10`,
          );
          if (!res.ok) continue;
          const data: AhspMatch[] = await res.json();
          // Filter by unit (case-insensitive)
          const matched = data.find(
            (a) =>
              a.unit.toLowerCase().replace("'", "") ===
              it.ahspUnit.toLowerCase(),
          );
          const best = matched ?? data[0] ?? null;
          if (cancelled) return;
          setSubItems((prev) => ({
            ...prev,
            [it.key]: {
              ...prev[it.key],
              ahsp: best,
              loadingAhsp: false,
            },
          }));
        } catch {
          if (cancelled) return;
          setSubItems((prev) => ({
            ...prev,
            [it.key]: { ...prev[it.key], loadingAhsp: false },
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stageType]);

  // Compute volumes per sub-item
  const computed = useMemo(() => {
    if (!stage) return {} as Record<string, ReturnType<StageItemDef["computeVolume"]>>;
    const out: Record<string, ReturnType<StageItemDef["computeVolume"]>> = {};
    for (const it of stage.items) {
      out[it.key] = it.computeVolume(inputs);
    }
    return out;
  }, [stage, inputs]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !stage) return null;

  const groupedInputs = groupBy(stage.inputs);

  // Items yang aktif (enabled + ada AHSP + showIf passed)
  const activeItems = stage.items.filter((it) => {
    const state = subItems[it.key];
    if (!state) return false;
    if (!state.enabled) return false;
    if (it.showIf && !it.showIf(inputs)) return false;
    if (computed[it.key] == null) return false;
    if (!state.ahsp) return false;
    return true;
  });

  // Dicentang + bisa dihitung + showIf-visible TAPI belum ada AHSP → akan
  // ter-skip saat simpan. Surface ke user, jangan diam-diam dibuang.
  const enabledUnmatched = stage.items.filter((it) => {
    const st = subItems[it.key];
    if (!st || !st.enabled) return false;
    if (it.showIf && !it.showIf(inputs)) return false;
    if (computed[it.key] == null) return false;
    return !st.ahsp;
  });

  function toggleEnabled(key: string) {
    setSubItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  }

  function setSearchOverride(key: string, q: string) {
    setSubItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], searchOverride: q },
    }));
  }

  async function searchAhsp(key: string) {
    const state = subItems[key];
    if (!state) return;
    const q = state.searchOverride.trim();
    if (!q) return;
    setSubItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], loadingAhsp: true },
    }));
    try {
      const res = await fetch(
        `/api/ahsp/search?q=${encodeURIComponent(q)}&limit=20`,
      );
      const data: AhspMatch[] = await res.json();
      // Tampilkan hasil sebagai daftar pilihan (user yang pilih) — bukan
      // auto-pick item pertama yang bisa salah/unit beda.
      setSubItems((prev) => ({
        ...prev,
        [key]: { ...prev[key], searchResults: data, loadingAhsp: false },
      }));
    } catch {
      setSubItems((prev) => ({
        ...prev,
        [key]: { ...prev[key], loadingAhsp: false, searchResults: [] },
      }));
    }
  }

  /** User memilih satu AHSP dari daftar hasil pencarian. */
  function pickAhsp(key: string, match: AhspMatch) {
    setSubItems((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ahsp: match,
        showSearch: false,
        searchResults: [],
      },
    }));
  }

  async function handleSave() {
    setError(null);
    if (!stage) return;
    const stageRef = stage; // narrow non-null
    const payload = activeItems.map((it) => {
      const state = subItems[it.key];
      const c = computed[it.key];
      return {
        ahspItemId: state.ahsp!.id,
        wbsItemId: wbsItemId || null,
        volume: c!.volume,
        calculatorType: stageRef.type,
        calculatorInputs: inputs,
        volumeFormula: c!.formula,
        customName: it.label,
      };
    });
    if (payload.length === 0) {
      setError("Tidak ada item terpilih untuk ditambah.");
      return;
    }
    start(async () => {
      const result = await createBulkProjectItems(
        projectId,
        JSON.stringify(payload),
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      onSuccess(result.created ?? 0, result.warnings);
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-3">
            <select
              value={stageType}
              onChange={(e) => setStageType(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-bold focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {STAGE_CALCULATORS.map((s) => (
                <option key={s.type} value={s.type}>
                  📐 {s.label}
                </option>
              ))}
            </select>
            <p className="hidden text-xs text-muted-foreground md:block">
              {stage.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Tutup"
          >
            ✕
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {/* WBS picker */}
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              WBS (opsional)
            </label>
            <select
              value={wbsItemId}
              onChange={(e) => setWbsItemId(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent md:w-2/3"
            >
              <option value="">— pilih WBS —</option>
              {wbsOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} {w.name.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>

          {/* Shared inputs */}
          <div className="mb-5">
            {groupedInputs.map((g) => (
              <div key={g.label} className="mb-4 last:mb-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
                  {g.label}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.inputs.map((inp) => (
                    <InputField
                      key={inp.key}
                      def={inp}
                      value={inputs[inp.key] ?? inp.default ?? 0}
                      onChange={(v) =>
                        setInputs((prev) => ({ ...prev, [inp.key]: v }))
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Sub-items */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
              Pekerjaan yang Akan Ditambah
            </p>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              {stage.items.map((it) => {
                const state = subItems[it.key] ?? {
                  enabled: false,
                  ahsp: null,
                  loadingAhsp: false,
                  searchOverride: "",
                  showSearch: false,
                  searchResults: [],
                };
                const c = computed[it.key];
                const hidden = it.showIf && !it.showIf(inputs);
                if (hidden) return null;
                const cantCompute = c == null;
                const unitBeda =
                  state.ahsp != null &&
                  state.ahsp.unit.toLowerCase().replace("'", "") !==
                    it.ahspUnit.toLowerCase();

                return (
                  <li
                    key={it.key}
                    className={`flex items-start gap-3 px-4 py-3 ${state.enabled ? "" : "opacity-50"}`}
                  >
                    <input
                      type="checkbox"
                      id={`item-${it.key}`}
                      checked={state.enabled && !cantCompute}
                      disabled={cantCompute}
                      onChange={() => toggleEnabled(it.key)}
                      className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <label
                          htmlFor={`item-${it.key}`}
                          className="font-medium"
                        >
                          {it.label}
                        </label>
                        {c && (
                          <span className="font-mono text-sm font-semibold tabular-nums text-accent">
                            {formatNum(c.volume, 3)} {it.ahspUnit}
                          </span>
                        )}
                        {cantCompute && (
                          <span className="text-xs italic text-muted-foreground">
                            (gak applicable)
                          </span>
                        )}
                      </div>
                      {c && (
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {c.formula}
                        </p>
                      )}
                      {/* AHSP info */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        {state.loadingAhsp && (
                          <span className="text-muted-foreground">
                            Mencari AHSP…
                          </span>
                        )}
                        {!state.loadingAhsp && state.ahsp && (
                          <>
                            <span className="rounded border border-accent/30 bg-accent/5 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                              {state.ahsp.code}
                            </span>
                            <span className="text-muted-foreground">
                              {state.ahsp.name.slice(0, 60)}
                            </span>
                            {unitBeda && (
                              <span className="rounded border border-warning/40 bg-warning/5 px-1.5 py-0.5 text-[10px] text-warning">
                                ⚠ unit &quot;{state.ahsp.unit}&quot; ≠ {it.ahspUnit}
                                {" — cek"}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setSubItems((p) => ({
                                  ...p,
                                  [it.key]: {
                                    ...p[it.key],
                                    showSearch: !p[it.key].showSearch,
                                  },
                                }))
                              }
                              className="text-[10px] text-muted-foreground underline hover:text-accent"
                            >
                              ganti
                            </button>
                          </>
                        )}
                        {!state.loadingAhsp && !state.ahsp && (
                          <button
                            type="button"
                            onClick={() =>
                              setSubItems((p) => ({
                                ...p,
                                [it.key]: { ...p[it.key], showSearch: true },
                              }))
                            }
                            className="rounded border border-warning/40 bg-warning/5 px-1.5 py-0.5 text-[10px] font-medium text-warning hover:bg-warning/10"
                          >
                            ⚠ AHSP belum ada — pilih manual
                          </button>
                        )}
                      </div>
                      {/* Search + picker hasil */}
                      {(state.showSearch ||
                        (!state.loadingAhsp && !state.ahsp)) && (
                        <div className="mt-2">
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={state.searchOverride}
                              onChange={(e) =>
                                setSearchOverride(it.key, e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  searchAhsp(it.key);
                                }
                              }}
                              placeholder={`Cari AHSP (default: "${kwOf(it, inputs)}")`}
                              className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                            <button
                              type="button"
                              onClick={() => searchAhsp(it.key)}
                              className="rounded bg-accent px-2 py-1 text-xs font-medium text-white"
                            >
                              Cari
                            </button>
                          </div>
                          {state.searchResults.length > 0 && (
                            <ul className="mt-1.5 max-h-44 divide-y divide-border overflow-auto rounded border border-border bg-background">
                              {state.searchResults.map((r) => (
                                <li key={r.id}>
                                  <button
                                    type="button"
                                    onClick={() => pickAhsp(it.key, r)}
                                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent/10"
                                  >
                                    <span
                                      className={`shrink-0 rounded px-1 font-mono text-[9px] ${
                                        r.unit.toLowerCase().replace("'", "") ===
                                        it.ahspUnit.toLowerCase()
                                          ? "bg-accent/10 text-accent"
                                          : "bg-warning/10 text-warning"
                                      }`}
                                    >
                                      {r.unit}
                                    </span>
                                    <span className="shrink-0 font-mono text-[10px] text-accent">
                                      {r.code}
                                    </span>
                                    <span className="truncate text-[11px] text-muted-foreground">
                                      {r.name}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {state.searchOverride &&
                            !state.loadingAhsp &&
                            state.searchResults.length === 0 && (
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                Tidak ada hasil — coba kata kunci lain.
                              </p>
                            )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {enabledUnmatched.length > 0 && (
            <div className="mt-4 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
              ⚠ {enabledUnmatched.length} pekerjaan dicentang tapi belum ada AHSP
              ({enabledUnmatched.map((i) => i.label).join(", ")}) — akan di-skip
              saat simpan. Pilih AHSP manual atau matikan centangnya.
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-accent">{activeItems.length}</span>{" "}
            item akan ditambah ke project
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={pending}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={pending || activeItems.length === 0}
              onClick={handleSave}
            >
              {pending
                ? "Menyimpan…"
                : `+ Tambah ${activeItems.length} Item ke Project`}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupBy(
  inputs: CalcInputDef[],
): { label: string; inputs: CalcInputDef[] }[] {
  const map = new Map<string, CalcInputDef[]>();
  for (const inp of inputs) {
    const g = inp.group ?? "Dimensi";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(inp);
  }
  return Array.from(map.entries()).map(([label, inputs]) => ({
    label,
    inputs,
  }));
}

function InputField({
  def,
  value,
  onChange,
}: {
  def: CalcInputDef;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{def.label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.001"
          min={def.min ?? 0}
          value={value}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          className="flex-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-right font-mono text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <span className="w-12 shrink-0 text-[11px] font-mono text-muted-foreground">
          {def.unit}
        </span>
      </div>
      {def.hint && (
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
          {def.hint}
        </p>
      )}
    </div>
  );
}
