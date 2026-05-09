/**
 * Volume Calculator definitions + SVG diagrams.
 *
 * Tujuan: user input dimensi fisik (P, L, T) yang gampang dibayangin,
 * sistem auto-hitung volume + tampilin rumus breakdown + diagram.
 *
 * Tiap calculator:
 * - inputs: list field dimensi (key, label, unit, default)
 * - compute(inputs): hitung volume + return formula human-readable
 * - Diagram: SVG component yang nampilin sketch dengan label dimensi
 */

import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CalcInputDef = {
  key: string;
  label: string;
  unit: string;
  hint?: string;
  default?: number;
  min?: number;
};

export type ComputeResult = {
  value: number;
  formula: string; // human-readable, mis. "5 × 0.4 × 0.6 × 1 = 1.20 m³"
};

export type CalcDef = {
  type: string;
  label: string;
  description: string;
  outputUnit: string;
  outputLabel: string; // mis. "Volume Beton" atau "Luas Dinding"
  inputs: CalcInputDef[];
  compute: (inputs: Record<string, number>) => ComputeResult;
  Diagram: (props: { values: Record<string, number> }) => ReactNode;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG primitives
// ─────────────────────────────────────────────────────────────────────────────

const stroke = "currentColor";
const fillLight = "rgba(249, 115, 22, 0.06)"; // accent-orange/6%
const fillMid = "rgba(249, 115, 22, 0.12)";

function DimLabel({
  x,
  y,
  text,
  anchor = "middle",
}: {
  x: number;
  y: number;
  text: string;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className="fill-foreground font-mono text-[10px] font-semibold"
    >
      {text}
    </text>
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={1}
      className="text-muted-foreground"
      markerStart="url(#arrowStart)"
      markerEnd="url(#arrowEnd)"
    />
  );
}

function ArrowDefs() {
  return (
    <defs>
      <marker
        id="arrowStart"
        viewBox="0 0 10 10"
        refX="2"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
      </marker>
      <marker
        id="arrowEnd"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
      </marker>
    </defs>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Box (P × L × T) — buat galian, balok, plat, dst.
// ─────────────────────────────────────────────────────────────────────────────

function BoxDiagram({
  pLabel,
  lLabel,
  tLabel,
  // proporsi visual — gak perlu match real ratio
}: {
  pLabel: string; // panjang
  lLabel: string; // lebar
  tLabel: string; // tinggi/tebal
}) {
  // Isometric box: front face + top face + right face
  const x0 = 100; // front-bottom-left
  const y0 = 200;
  const w = 180; // panjang (P) terlihat di depan (lebar visual)
  const h = 80; // tinggi (T) face depan
  const dx = 60; // depth shift (lebar L)
  const dy = -40;

  const fp = { x: x0, y: y0 }; // front bottom-left
  const fb = { x: x0 + w, y: y0 }; // front bottom-right
  const ft = { x: x0 + w, y: y0 - h }; // front top-right
  const fl = { x: x0, y: y0 - h }; // front top-left

  const bp = { x: fp.x + dx, y: fp.y + dy };
  const bb = { x: fb.x + dx, y: fb.y + dy };
  const bt = { x: ft.x + dx, y: ft.y + dy };
  const bl = { x: fl.x + dx, y: fl.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <ArrowDefs />
      {/* Hidden edges */}
      <line
        x1={fp.x}
        y1={fp.y}
        x2={bp.x}
        y2={bp.y}
        stroke={stroke}
        strokeWidth={1}
        strokeDasharray="3 3"
        className="text-muted-foreground/50"
      />
      {/* Top face */}
      <polygon
        points={`${fl.x},${fl.y} ${ft.x},${ft.y} ${bt.x},${bt.y} ${bl.x},${bl.y}`}
        fill={fillMid}
        stroke={stroke}
        strokeWidth={1.6}
        className="text-accent"
      />
      {/* Right face */}
      <polygon
        points={`${fb.x},${fb.y} ${ft.x},${ft.y} ${bt.x},${bt.y} ${bb.x},${bb.y}`}
        fill={fillLight}
        stroke={stroke}
        strokeWidth={1.6}
        className="text-accent"
      />
      {/* Front face */}
      <polygon
        points={`${fp.x},${fp.y} ${fb.x},${fb.y} ${ft.x},${ft.y} ${fl.x},${fl.y}`}
        fill={fillLight}
        stroke={stroke}
        strokeWidth={1.8}
        className="text-accent"
      />

      {/* Dimension: P (panjang, di bawah front face) */}
      <Arrow x1={fp.x} y1={fp.y + 22} x2={fb.x} y2={fb.y + 22} />
      <DimLabel x={(fp.x + fb.x) / 2} y={fp.y + 38} text={pLabel} />

      {/* Dimension: L (lebar, di kanan bawah depth) */}
      <Arrow x1={fb.x + 18} y1={fb.y + 8} x2={bb.x + 18} y2={bb.y + 8} />
      <DimLabel x={(fb.x + bb.x) / 2 + 26} y={(fb.y + bb.y) / 2 + 14} text={lLabel} />

      {/* Dimension: T (tinggi, di kiri front face) */}
      <Arrow x1={fp.x - 16} y1={fp.y} x2={fl.x - 16} y2={fl.y} />
      <DimLabel x={fp.x - 24} y={(fp.y + fl.y) / 2 + 4} text={tLabel} anchor="end" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Column (vertical, square cross-section)
// ─────────────────────────────────────────────────────────────────────────────

function ColumnDiagram({
  sideLabel,
  heightLabel,
}: {
  sideLabel: string;
  heightLabel: string;
}) {
  const x0 = 130;
  const y0 = 240;
  const w = 60; // sisi
  const h = 180; // tinggi
  const dx = 30;
  const dy = -22;

  const fp = { x: x0, y: y0 };
  const fb = { x: x0 + w, y: y0 };
  const ft = { x: x0 + w, y: y0 - h };
  const fl = { x: x0, y: y0 - h };

  const bp = { x: fp.x + dx, y: fp.y + dy };
  const bb = { x: fb.x + dx, y: fb.y + dy };
  const bt = { x: ft.x + dx, y: ft.y + dy };
  const bl = { x: fl.x + dx, y: fl.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <ArrowDefs />
      <line
        x1={fp.x}
        y1={fp.y}
        x2={bp.x}
        y2={bp.y}
        stroke={stroke}
        strokeWidth={1}
        strokeDasharray="3 3"
        className="text-muted-foreground/50"
      />
      <polygon
        points={`${fl.x},${fl.y} ${ft.x},${ft.y} ${bt.x},${bt.y} ${bl.x},${bl.y}`}
        fill={fillMid}
        stroke={stroke}
        strokeWidth={1.6}
        className="text-accent"
      />
      <polygon
        points={`${fb.x},${fb.y} ${ft.x},${ft.y} ${bt.x},${bt.y} ${bb.x},${bb.y}`}
        fill={fillLight}
        stroke={stroke}
        strokeWidth={1.6}
        className="text-accent"
      />
      <polygon
        points={`${fp.x},${fp.y} ${fb.x},${fb.y} ${ft.x},${ft.y} ${fl.x},${fl.y}`}
        fill={fillLight}
        stroke={stroke}
        strokeWidth={1.8}
        className="text-accent"
      />

      {/* Dimension: T (tinggi) */}
      <Arrow x1={fp.x - 16} y1={fp.y} x2={fl.x - 16} y2={fl.y} />
      <DimLabel x={fp.x - 24} y={(fp.y + fl.y) / 2 + 4} text={heightLabel} anchor="end" />

      {/* Dimension: sisi (lebar) di bawah */}
      <Arrow x1={fp.x} y1={fp.y + 22} x2={fb.x} y2={fb.y + 22} />
      <DimLabel x={(fp.x + fb.x) / 2} y={fp.y + 38} text={sideLabel} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Wall (P × T × tebal) — dinding
// ─────────────────────────────────────────────────────────────────────────────

function WallDiagram({
  panjangLabel,
  tinggiLabel,
  tebalLabel,
  bukaanText,
}: {
  panjangLabel: string;
  tinggiLabel: string;
  tebalLabel: string;
  bukaanText?: string;
}) {
  const x0 = 80;
  const y0 = 220;
  const w = 220;
  const h = 130;
  const dx = 30;
  const dy = -22;

  const fp = { x: x0, y: y0 };
  const fb = { x: x0 + w, y: y0 };
  const ft = { x: x0 + w, y: y0 - h };
  const fl = { x: x0, y: y0 - h };

  const bp = { x: fp.x + dx, y: fp.y + dy };
  const bb = { x: fb.x + dx, y: fb.y + dy };
  const bt = { x: ft.x + dx, y: ft.y + dy };
  const bl = { x: fl.x + dx, y: fl.y + dy };

  // Window opening on front face
  const opx = x0 + 70;
  const opy = y0 - 90;
  const opw = 50;
  const oph = 50;

  // Door opening
  const dpx = x0 + 150;
  const dpy = y0 - 90;
  const dpw = 32;
  const dph = 90;

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <ArrowDefs />
      {/* Top face */}
      <polygon
        points={`${fl.x},${fl.y} ${ft.x},${ft.y} ${bt.x},${bt.y} ${bl.x},${bl.y}`}
        fill={fillMid}
        stroke={stroke}
        strokeWidth={1.4}
        className="text-accent"
      />
      {/* Right face (tebal) */}
      <polygon
        points={`${fb.x},${fb.y} ${ft.x},${ft.y} ${bt.x},${bt.y} ${bb.x},${bb.y}`}
        fill={fillLight}
        stroke={stroke}
        strokeWidth={1.4}
        className="text-accent"
      />
      {/* Front face */}
      <polygon
        points={`${fp.x},${fp.y} ${fb.x},${fb.y} ${ft.x},${ft.y} ${fl.x},${fl.y}`}
        fill={fillLight}
        stroke={stroke}
        strokeWidth={1.8}
        className="text-accent"
      />
      {/* Bukaan: jendela */}
      <rect
        x={opx}
        y={opy}
        width={opw}
        height={oph}
        fill="white"
        stroke={stroke}
        strokeWidth={1}
        className="text-muted-foreground"
      />
      <line
        x1={opx + opw / 2}
        y1={opy}
        x2={opx + opw / 2}
        y2={opy + oph}
        stroke={stroke}
        strokeWidth={1}
        className="text-muted-foreground"
      />
      <line
        x1={opx}
        y1={opy + oph / 2}
        x2={opx + opw}
        y2={opy + oph / 2}
        stroke={stroke}
        strokeWidth={1}
        className="text-muted-foreground"
      />
      {/* Bukaan: pintu */}
      <rect
        x={dpx}
        y={dpy}
        width={dpw}
        height={dph}
        fill="white"
        stroke={stroke}
        strokeWidth={1}
        className="text-muted-foreground"
      />

      {/* Dimensions */}
      <Arrow x1={fp.x} y1={fp.y + 22} x2={fb.x} y2={fb.y + 22} />
      <DimLabel x={(fp.x + fb.x) / 2} y={fp.y + 38} text={panjangLabel} />

      <Arrow x1={fp.x - 16} y1={fp.y} x2={fl.x - 16} y2={fl.y} />
      <DimLabel x={fp.x - 24} y={(fp.y + fl.y) / 2 + 4} text={tinggiLabel} anchor="end" />

      <Arrow x1={fb.x + 8} y1={fb.y + 4} x2={bb.x + 8} y2={bb.y + 4} />
      <DimLabel x={fb.x + 18} y={(fb.y + bb.y) / 2 + 14} text={tebalLabel} />

      {bukaanText && (
        <text
          x={x0 + w / 2}
          y={y0 + 58}
          textAnchor="middle"
          className="fill-muted-foreground font-mono text-[10px] italic"
        >
          {bukaanText}
        </text>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Plaster (2 sisi dinding plesteran)
// ─────────────────────────────────────────────────────────────────────────────

function PlasterDiagram({
  panjangLabel,
  tinggiLabel,
  sisiText,
}: {
  panjangLabel: string;
  tinggiLabel: string;
  sisiText: string;
}) {
  const x0 = 80;
  const y0 = 220;
  const w = 220;
  const h = 130;
  const dx = 22;
  const dy = -16;

  const fp = { x: x0, y: y0 };
  const fb = { x: x0 + w, y: y0 };
  const ft = { x: x0 + w, y: y0 - h };
  const fl = { x: x0, y: y0 - h };
  const bl = { x: fl.x + dx, y: fl.y + dy };
  const bt = { x: ft.x + dx, y: ft.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <ArrowDefs />
      {/* Wall front */}
      <polygon
        points={`${fp.x},${fp.y} ${fb.x},${fb.y} ${ft.x},${ft.y} ${fl.x},${fl.y}`}
        fill={fillLight}
        stroke={stroke}
        strokeWidth={1.6}
        className="text-accent"
      />
      {/* Plaster lines (front - hatching) */}
      {Array.from({ length: 6 }, (_, i) => i + 1).map((i) => (
        <line
          key={`f${i}`}
          x1={x0 + (i * w) / 7}
          y1={y0}
          x2={x0 + (i * w) / 7}
          y2={y0 - h}
          stroke={stroke}
          strokeWidth={0.6}
          strokeDasharray="2 4"
          className="text-accent/40"
        />
      ))}
      {/* Top face / 2nd side preview */}
      <polygon
        points={`${fl.x},${fl.y} ${ft.x},${ft.y} ${bt.x},${bt.y} ${bl.x},${bl.y}`}
        fill={fillMid}
        stroke={stroke}
        strokeWidth={1.4}
        className="text-accent"
      />

      {/* Dimensions */}
      <Arrow x1={fp.x} y1={fp.y + 22} x2={fb.x} y2={fb.y + 22} />
      <DimLabel x={(fp.x + fb.x) / 2} y={fp.y + 38} text={panjangLabel} />
      <Arrow x1={fp.x - 16} y1={fp.y} x2={fl.x - 16} y2={fl.y} />
      <DimLabel x={fp.x - 24} y={(fp.y + fl.y) / 2 + 4} text={tinggiLabel} anchor="end" />

      <text
        x={x0 + w / 2}
        y={y0 + 58}
        textAnchor="middle"
        className="fill-accent font-mono text-[11px] font-semibold"
      >
        {sisiText}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculator definitions
// ─────────────────────────────────────────────────────────────────────────────

export const CALCULATORS: CalcDef[] = [
  // 1. Galian / Pondasi Tapak / Galian Pondasi Menerus (volume m³)
  {
    type: "galian_tapak",
    label: "Galian / Pondasi Tapak",
    description: "Hitung volume galian atau pondasi tapak/menerus dari panjang × lebar × tinggi.",
    outputUnit: "m³",
    outputLabel: "Volume Galian/Pondasi",
    inputs: [
      { key: "P", label: "Panjang", unit: "m", default: 1, min: 0 },
      { key: "L", label: "Lebar", unit: "m", default: 1, min: 0 },
      { key: "T", label: "Kedalaman / Tinggi", unit: "m", default: 1, min: 0 },
      { key: "n", label: "Jumlah", unit: "titik", default: 1, min: 1 },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const T = num(i.T);
      const n = num(i.n, 1);
      const v = P * L * T * n;
      const formula = `${fmt(P, 3)} × ${fmt(L, 3)} × ${fmt(T, 3)} × ${fmt(n, 0)} = ${fmt(v, 3)} m³`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <BoxDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  // 2. Sloof / Balok Beton (volume m³)
  {
    type: "sloof_balok",
    label: "Sloof / Balok Beton",
    description: "Volume beton untuk sloof atau balok lurus, dengan jumlah segmen.",
    outputUnit: "m³",
    outputLabel: "Volume Beton",
    inputs: [
      { key: "P", label: "Panjang Total", unit: "m", default: 1, min: 0, hint: "Total panjang semua segmen" },
      { key: "L", label: "Lebar", unit: "m", default: 0.15, min: 0 },
      { key: "T", label: "Tinggi", unit: "m", default: 0.2, min: 0 },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const T = num(i.T);
      const v = P * L * T;
      const formula = `${fmt(P, 2)} × ${fmt(L, 3)} × ${fmt(T, 3)} = ${fmt(v, 3)} m³`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <BoxDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  // 3. Kolom Beton (volume m³)
  {
    type: "kolom",
    label: "Kolom Beton",
    description: "Volume beton kolom (penampang persegi).",
    outputUnit: "m³",
    outputLabel: "Volume Beton Kolom",
    inputs: [
      { key: "sisi", label: "Sisi Penampang", unit: "m", default: 0.2, min: 0, hint: "Misal 0.2 untuk kolom 20×20 cm" },
      { key: "T", label: "Tinggi Kolom", unit: "m", default: 3, min: 0 },
      { key: "n", label: "Jumlah Kolom", unit: "buah", default: 1, min: 1 },
    ],
    compute: (i) => {
      const s = num(i.sisi);
      const T = num(i.T);
      const n = num(i.n, 1);
      const v = s * s * T * n;
      const formula = `${fmt(s, 3)} × ${fmt(s, 3)} × ${fmt(T, 2)} × ${fmt(n, 0)} = ${fmt(v, 3)} m³`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <ColumnDiagram
        sideLabel={`s = ${fmt(num(values.sisi), 2)} m`}
        heightLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  // 4. Plat Lantai / Dak (volume m³)
  {
    type: "plat_lantai",
    label: "Plat Lantai / Dak",
    description: "Volume beton plat lantai atau dak datar.",
    outputUnit: "m³",
    outputLabel: "Volume Beton Plat",
    inputs: [
      { key: "P", label: "Panjang", unit: "m", default: 6, min: 0 },
      { key: "L", label: "Lebar", unit: "m", default: 4, min: 0 },
      { key: "T", label: "Tebal", unit: "m", default: 0.12, min: 0 },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const T = num(i.T);
      const v = P * L * T;
      const formula = `${fmt(P, 2)} × ${fmt(L, 2)} × ${fmt(T, 3)} = ${fmt(v, 3)} m³`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <BoxDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  // 5. Pasangan Dinding (luas m²)
  {
    type: "dinding_pasangan",
    label: "Pasangan Dinding (Bata/Hebel)",
    description: "Luas pasangan dinding dikurangi luas bukaan (pintu/jendela).",
    outputUnit: "m²",
    outputLabel: "Luas Pasangan Dinding",
    inputs: [
      { key: "P", label: "Panjang Dinding", unit: "m", default: 5, min: 0 },
      { key: "T", label: "Tinggi Dinding", unit: "m", default: 3, min: 0 },
      { key: "bukaan", label: "Total Luas Bukaan", unit: "m²", default: 0, min: 0, hint: "Jumlah luas pintu + jendela" },
    ],
    compute: (i) => {
      const P = num(i.P);
      const T = num(i.T);
      const b = num(i.bukaan);
      const v = Math.max(0, P * T - b);
      const formula = `(${fmt(P, 2)} × ${fmt(T, 2)}) − ${fmt(b, 2)} = ${fmt(v, 2)} m²`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <WallDiagram
        panjangLabel={`P = ${fmt(num(values.P), 2)} m`}
        tinggiLabel={`T = ${fmt(num(values.T), 2)} m`}
        tebalLabel={`tebal`}
        bukaanText={
          num(values.bukaan) > 0
            ? `Bukaan: ${fmt(num(values.bukaan), 2)} m²`
            : undefined
        }
      />
    ),
  },

  // 6. Plesteran (luas m²)
  {
    type: "plesteran",
    label: "Plesteran Dinding",
    description: "Luas plesteran (pilih 1 sisi atau 2 sisi).",
    outputUnit: "m²",
    outputLabel: "Luas Plesteran",
    inputs: [
      { key: "P", label: "Panjang Dinding", unit: "m", default: 5, min: 0 },
      { key: "T", label: "Tinggi Dinding", unit: "m", default: 3, min: 0 },
      { key: "sisi", label: "Jumlah Sisi", unit: "sisi", default: 2, min: 1, hint: "1 atau 2 (depan-belakang)" },
      { key: "bukaan", label: "Total Luas Bukaan", unit: "m²", default: 0, min: 0 },
    ],
    compute: (i) => {
      const P = num(i.P);
      const T = num(i.T);
      const s = num(i.sisi, 2);
      const b = num(i.bukaan);
      const v = Math.max(0, (P * T - b) * s);
      const formula = `(${fmt(P, 2)} × ${fmt(T, 2)} − ${fmt(b, 2)}) × ${fmt(s, 0)} = ${fmt(v, 2)} m²`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <PlasterDiagram
        panjangLabel={`P = ${fmt(num(values.P), 2)} m`}
        tinggiLabel={`T = ${fmt(num(values.T), 2)} m`}
        sisiText={`${fmt(num(values.sisi, 2), 0)} sisi`}
      />
    ),
  },
];

export function getCalculator(type: string | null | undefined): CalcDef | null {
  if (!type) return null;
  return CALCULATORS.find((c) => c.type === type) ?? null;
}
