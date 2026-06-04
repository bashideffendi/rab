"use client";

import { useEffect, useMemo, useState } from "react";
import { CALCULATORS, getCalculator } from "@/lib/volume-calculators";

// Kelompokkan kalkulator single biar dropdown gak flat 20+ opsi (keluhan UX).
const CALC_GROUPS: { label: string; types: string[] }[] = [
  {
    label: "Tanah & Pondasi",
    types: ["galian_tapak", "galian_saluran", "timbunan", "pondasi_batu_kali"],
  },
  {
    label: "Beton — Pelengkap",
    types: ["bekisting_kolom", "bekisting_balok", "bekisting_plat", "pembesian"],
  },
  {
    label: "Dinding",
    types: ["dinding_pasangan", "plesteran", "acian", "cat_dinding"],
  },
  { label: "Atap & Rangka", types: ["atap", "rangka_baja_ringan", "kuda_kuda"] },
  { label: "Bukaan & Kayu", types: ["kusen"] },
  {
    label: "Lantai & Plafon",
    types: ["lantai_keramik", "plint", "plafon", "cat_plafon", "waterproofing"],
  },
  { label: "Persiapan", types: ["bowplank"] },
];

/**
 * VolumeCalculator — UI buat input dimensi → auto-hitung volume.
 *
 * Mode:
 * - "manual": user input volume langsung (default)
 * - calculator type (mis. "galian_tapak"): user input dimensi, volume auto.
 *
 * Submit ke parent via onChange dengan { volume, calculatorType, calculatorInputs, formula }.
 */

export type VolumeCalculatorState = {
  volume: string; // submit-ready string, mis. "1.20"
  calculatorType: string | null;
  calculatorInputs: Record<string, number> | null;
  formula: string | null;
  /** Output unit dari calculator yang aktif (mis. "m³", "LS", "m'"). Null
   *  untuk mode manual. Parent boleh pakai ini untuk auto-fill field
   *  satuan di custom item. */
  outputUnit: string | null;
};

export function VolumeCalculator({
  defaultMode = "manual",
  defaultVolume = "",
  defaultInputs = null,
  mode: modeProp,
  onModeChange,
  onChange,
  volumeFieldName = "volume",
  calcTypeFieldName = "calculatorType",
  calcInputsFieldName = "calculatorInputs",
  formulaFieldName = "volumeFormula",
}: {
  defaultMode?: string;
  defaultVolume?: string;
  defaultInputs?: Record<string, number> | null;
  /** Kalau di-pass, mode jadi controlled — parent ngendaliin lewat
   *  onModeChange. Berguna buat sync mode dari luar (mis. saat user
   *  pilih satuan "LS" dari datalist → auto switch ke "lumsum"). */
  mode?: string;
  onModeChange?: (mode: string) => void;
  onChange?: (state: VolumeCalculatorState) => void;
  volumeFieldName?: string;
  calcTypeFieldName?: string;
  calcInputsFieldName?: string;
  formulaFieldName?: string;
}) {
  const [internalMode, setInternalMode] = useState<string>(defaultMode);
  const mode = modeProp ?? internalMode;
  const setMode = (next: string) => {
    if (modeProp === undefined) setInternalMode(next);
    onModeChange?.(next);
  };
  const [manualVolume, setManualVolume] = useState(defaultVolume);
  const [inputs, setInputs] = useState<Record<string, number>>(
    defaultInputs ?? {},
  );

  const calc = useMemo(() => getCalculator(mode), [mode]);

  // Initialize default values saat ganti calculator type
  useEffect(() => {
    if (!calc) return;
    setInputs((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const i of calc.inputs) {
        if (next[i.key] === undefined) {
          next[i.key] = i.default ?? 0;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [calc]);

  const result = useMemo(() => {
    if (!calc) return null;
    return calc.compute(inputs);
  }, [calc, inputs]);

  // Notify parent on changes
  useEffect(() => {
    if (!onChange) return;
    if (calc && result) {
      onChange({
        volume: result.value.toFixed(4),
        calculatorType: mode,
        calculatorInputs: inputs,
        formula: result.formula,
        outputUnit: calc.outputUnit,
      });
    } else {
      onChange({
        volume: manualVolume,
        calculatorType: null,
        calculatorInputs: null,
        formula: null,
        outputUnit: null,
      });
    }
  }, [calc, result, mode, inputs, manualVolume, onChange]);

  // Effective volume yang akan disubmit
  const effectiveVolume = result ? result.value.toFixed(4) : manualVolume;

  return (
    <div className="space-y-3">
      {/* Mode picker */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="calc-type"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Hitung Volume
        </label>
        <select
          id="calc-type"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="manual">📝 Manual — input volume langsung</option>
          {CALC_GROUPS.map((g) => {
            const items = CALCULATORS.filter(
              (c) => !c.hidden && g.types.includes(c.type),
            );
            if (items.length === 0) return null;
            return (
              <optgroup key={g.label} label={g.label}>
                {items.map((c) => (
                  <option key={c.type} value={c.type}>
                    📐 {c.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
          {(() => {
            const known = new Set(CALC_GROUPS.flatMap((g) => g.types));
            const rest = CALCULATORS.filter(
              (c) => !c.hidden && !known.has(c.type),
            );
            return rest.length > 0 ? (
              <optgroup label="Lainnya">
                {rest.map((c) => (
                  <option key={c.type} value={c.type}>
                    📐 {c.label}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })()}
        </select>
        {calc && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            {calc.description}
          </p>
        )}
      </div>

      {/* Manual mode: simple volume input */}
      {!calc && (
        <div>
          <label
            htmlFor="manual-vol"
            className="mb-1 block text-xs font-medium text-foreground"
          >
            Volume <span className="text-danger">*</span>
          </label>
          <input
            id="manual-vol"
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            value={manualVolume}
            onChange={(e) => setManualVolume(e.target.value)}
            placeholder="Mis. 100"
            className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-right text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      {/* Calculator mode: dimensions form + diagram + result */}
      {calc && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Left: form inputs grouped by section */}
            <div>
              {groupInputs(calc.inputs).map((group) => (
                <div key={group.label} className="mb-3 last:mb-0">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-2">
                    {group.inputs.map((inp) => (
                      <CalcInputRow
                        key={inp.key}
                        inp={inp}
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

            {/* Right: SVG diagram */}
            <div className="flex flex-col">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sketsa
              </p>
              <div className="flex-1 rounded-md border border-border bg-muted/20 p-2 text-accent">
                <calc.Diagram values={inputs} />
              </div>
            </div>
          </div>

          {/* Result */}
          {result && (
            <>
              <div className="mt-4 flex items-baseline justify-between gap-3 rounded-md border border-accent/30 bg-accent/5 px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {calc.outputLabel}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {result.formula}
                  </p>
                </div>
                <p className="font-mono text-2xl font-bold tabular-nums text-accent">
                  {result.value.toLocaleString("id-ID", {
                    maximumFractionDigits: 3,
                  })}{" "}
                  <span className="text-sm font-semibold">
                    {calc.outputUnit}
                  </span>
                </p>
              </div>

              {/* Supplementary info (jumlah patok, vol kayu, dll) */}
              {result.info && result.info.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {result.info.map((entry, i) => (
                    <div
                      key={i}
                      className={`rounded-md border px-3 py-2 ${
                        entry.highlight
                          ? "border-accent/40 bg-accent/5"
                          : "border-border bg-muted/30"
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {entry.label}
                      </p>
                      <p
                        className={`mt-0.5 font-mono text-xs font-semibold tabular-nums ${
                          entry.highlight ? "text-accent" : "text-foreground"
                        }`}
                      >
                        {entry.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Hidden inputs untuk submit ke server action */}
      <input type="hidden" name={volumeFieldName} value={effectiveVolume} />
      <input
        type="hidden"
        name={calcTypeFieldName}
        value={calc ? mode : ""}
      />
      <input
        type="hidden"
        name={calcInputsFieldName}
        value={calc ? JSON.stringify(inputs) : ""}
      />
      <input
        type="hidden"
        name={formulaFieldName}
        value={result ? result.formula : ""}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — group inputs by section + render row (with optional dropdown)
// ─────────────────────────────────────────────────────────────────────────────

function groupInputs(
  inputs: import("@/lib/volume-calculators").CalcInputDef[],
): { label: string; inputs: typeof inputs }[] {
  const map = new Map<string, typeof inputs>();
  for (const inp of inputs) {
    const g = inp.group ?? "Dimensi Utama";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(inp);
  }
  // Preserve insertion order: Dimensi Utama first, then others
  const order = Array.from(map.keys());
  return order.map((label) => ({ label, inputs: map.get(label)! }));
}

function CalcInputRow({
  inp,
  value,
  onChange,
}: {
  inp: import("@/lib/volume-calculators").CalcInputDef;
  value: number;
  onChange: (v: number) => void;
}) {
  const isDropdown = !!inp.options && inp.options.length > 0;
  return (
    <div>
      <div className="flex items-center gap-2">
        <label
          htmlFor={`calc-${inp.key}`}
          className="w-32 shrink-0 text-xs font-medium"
        >
          {inp.label}
        </label>
        {isDropdown ? (
          <select
            id={`calc-${inp.key}`}
            value={String(value)}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {inp.options!.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`calc-${inp.key}`}
            type="number"
            inputMode="decimal"
            step="0.001"
            min={inp.min ?? 0}
            value={value}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              onChange(Number.isFinite(n) ? n : 0);
            }}
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-right font-mono text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        )}
        <span className="w-12 shrink-0 text-[11px] font-mono text-muted-foreground">
          {inp.unit}
        </span>
      </div>
      {inp.hint && (
        <p className="ml-32 mt-0.5 pl-2 text-[10px] leading-snug text-muted-foreground">
          {inp.hint}
        </p>
      )}
    </div>
  );
}
