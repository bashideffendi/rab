/**
 * Volume Calculator definitions + SVG diagrams.
 *
 * Diagram style: terinspirasi AutoRAB Pro — realistic material colors,
 * gradient-shaded faces buat fake 3D, construction details (rebar,
 * brick courses), proper perspective. Pure SVG inline (gak depend
 * library 3D atau image asset).
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
  /** Section grouping. Default = "Dimensi Utama". Mis. "Spesifikasi" buat
   *  field non-dimensional (mutu beton, jumlah sengkang, dll). */
  group?: string;
  /** Pakai dropdown alih-alih number input. Untuk diameter besi, mutu
   *  beton, jenis bata, dll. */
  options?: { value: number; label: string }[];
};

export type ComputeInfo = {
  label: string;
  value: string;
  highlight?: boolean;
};

export type ComputeResult = {
  /** Output utama (sesuai outputUnit) yang akan dipakai sebagai volume
   *  untuk dikalikan dengan AHSP harga satuan. */
  value: number;
  formula: string;
  /** Output supplementer / info tambahan ditampilkan di bawah hasil utama.
   *  Mis. jumlah patok, volume kayu, dll. */
  info?: ComputeInfo[];
};

export type CalcDef = {
  type: string;
  label: string;
  description: string;
  outputUnit: string;
  outputLabel: string;
  inputs: CalcInputDef[];
  compute: (inputs: Record<string, number>) => ComputeResult;
  Diagram: (props: { values: Record<string, number> }) => ReactNode;
  /** Sembunyikan dari dropdown picker. Calculator masih bisa di-resolve via
   *  getCalculator() untuk preserve data lama. */
  hidden?: boolean;
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

/**
 * Tabel diameter besi (mm) → berat per meter (kg/m).
 * Sumber: AutoRAB Pro reference / standar konstruksi Indonesia.
 */
const REBAR_WEIGHT: Record<number, number> = {
  4: 0.099,
  6: 0.222,
  8: 0.395,
  9: 0.499,
  10: 0.617,
  11: 0.746,
  12: 0.888,
  13: 1.042,
  14: 1.208,
  15: 1.387,
  16: 1.578,
  19: 2.226,
  22: 2.984,
  23: 3.262,
  24: 3.553,
  25: 3.853,
  28: 4.834,
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared SVG defs (gradients + patterns) — diinclude di tiap diagram
// ─────────────────────────────────────────────────────────────────────────────

function SharedDefs() {
  return (
    <defs>
      {/* Concrete (beton) shading */}
      <linearGradient id="concrete-front" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#bcbcbc" />
        <stop offset="100%" stopColor="#7a7a7a" />
      </linearGradient>
      <linearGradient id="concrete-top" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#dcdcdc" />
        <stop offset="100%" stopColor="#a8a8a8" />
      </linearGradient>
      <linearGradient id="concrete-side" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#909090" />
        <stop offset="100%" stopColor="#5d5d5d" />
      </linearGradient>

      {/* Earth / soil (galian) */}
      <linearGradient id="earth-side" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#a07f4e" />
        <stop offset="100%" stopColor="#5e4724" />
      </linearGradient>
      <linearGradient id="earth-bottom" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#7a5d33" />
        <stop offset="100%" stopColor="#4d3a1f" />
      </linearGradient>
      <pattern
        id="earth-tex"
        patternUnits="userSpaceOnUse"
        width="6"
        height="6"
      >
        <rect width="6" height="6" fill="url(#earth-side)" />
        <circle cx="2" cy="2" r="0.5" fill="#3e2c14" opacity="0.6" />
        <circle cx="4" cy="4" r="0.5" fill="#3e2c14" opacity="0.5" />
      </pattern>

      {/* Brick (bata merah) */}
      <pattern
        id="brick-tex"
        patternUnits="userSpaceOnUse"
        width="32"
        height="14"
      >
        <rect width="32" height="14" fill="#a85037" />
        <line x1="0" y1="0" x2="32" y2="0" stroke="#6f3220" strokeWidth="1" />
        <line x1="0" y1="7" x2="32" y2="7" stroke="#6f3220" strokeWidth="0.8" />
        <line
          x1="16"
          y1="0"
          x2="16"
          y2="7"
          stroke="#6f3220"
          strokeWidth="0.8"
        />
        <line
          x1="0"
          y1="7"
          x2="0"
          y2="14"
          stroke="#6f3220"
          strokeWidth="0.8"
        />
        <line
          x1="32"
          y1="7"
          x2="32"
          y2="14"
          stroke="#6f3220"
          strokeWidth="0.8"
        />
      </pattern>
      <linearGradient id="brick-shade" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
      </linearGradient>

      {/* Plaster (semen halus) */}
      <linearGradient id="plaster-front" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#e8dfcd" />
        <stop offset="100%" stopColor="#bdaf8e" />
      </linearGradient>
      <linearGradient id="plaster-side" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#a99a78" />
        <stop offset="100%" stopColor="#7a6c4d" />
      </linearGradient>

      {/* Stone (batu kali) — random irregular shapes */}
      <pattern
        id="stone-tex"
        patternUnits="userSpaceOnUse"
        width="36"
        height="24"
      >
        <rect width="36" height="24" fill="#7a7066" />
        <ellipse cx="8" cy="6" rx="6" ry="4" fill="#5d544a" stroke="#3d362e" strokeWidth="0.5" />
        <ellipse cx="22" cy="9" rx="7" ry="5" fill="#8a7d70" stroke="#3d362e" strokeWidth="0.5" />
        <ellipse cx="6" cy="18" rx="5" ry="4" fill="#9a9085" stroke="#3d362e" strokeWidth="0.5" />
        <ellipse cx="26" cy="19" rx="6" ry="3.5" fill="#6a615a" stroke="#3d362e" strokeWidth="0.5" />
        <ellipse cx="15" cy="14" rx="3" ry="2.5" fill="#8a7d70" stroke="#3d362e" strokeWidth="0.5" />
      </pattern>

      {/* Roof tiles (genteng) — wave pattern */}
      <pattern
        id="tile-roof"
        patternUnits="userSpaceOnUse"
        width="14"
        height="10"
      >
        <rect width="14" height="10" fill="#c43e1c" />
        <path
          d="M0,3 Q3.5,0 7,3 Q10.5,6 14,3"
          fill="none"
          stroke="#7a2410"
          strokeWidth="0.7"
        />
        <path
          d="M0,8 Q3.5,5 7,8 Q10.5,11 14,8"
          fill="none"
          stroke="#7a2410"
          strokeWidth="0.7"
        />
      </pattern>

      {/* Floor tile (lantai keramik) — square grid */}
      <pattern
        id="floor-tile"
        patternUnits="userSpaceOnUse"
        width="22"
        height="22"
      >
        <rect width="22" height="22" fill="#e8e3d6" />
        <line x1="0" y1="0" x2="22" y2="0" stroke="#a3997a" strokeWidth="0.6" />
        <line x1="0" y1="22" x2="22" y2="22" stroke="#a3997a" strokeWidth="0.6" />
        <line x1="0" y1="0" x2="0" y2="22" stroke="#a3997a" strokeWidth="0.6" />
        <line x1="22" y1="0" x2="22" y2="22" stroke="#a3997a" strokeWidth="0.6" />
      </pattern>

      {/* Compacted earth (timbunan) — layered */}
      <pattern
        id="compact-earth"
        patternUnits="userSpaceOnUse"
        width="12"
        height="12"
      >
        <rect width="12" height="12" fill="#9a8460" />
        <circle cx="2" cy="3" r="0.8" fill="#5e4724" />
        <circle cx="6" cy="6" r="0.6" fill="#5e4724" />
        <circle cx="9" cy="2" r="0.5" fill="#5e4724" />
        <circle cx="4" cy="9" r="0.7" fill="#5e4724" />
        <circle cx="10" cy="9" r="0.6" fill="#5e4724" />
      </pattern>

      {/* Wood / Plywood (bekisting) — vertical grain */}
      <pattern
        id="wood-tex"
        patternUnits="userSpaceOnUse"
        width="14"
        height="40"
      >
        <rect width="14" height="40" fill="#d8a96a" />
        <line x1="2" y1="0" x2="2" y2="40" stroke="#a87a3d" strokeWidth="0.4" />
        <line x1="6" y1="0" x2="6" y2="40" stroke="#8b6f3d" strokeWidth="0.6" />
        <line x1="10" y1="0" x2="10" y2="40" stroke="#a87a3d" strokeWidth="0.4" />
        <ellipse cx="6" cy="14" rx="2" ry="0.8" fill="#7a5520" opacity="0.6" />
        <ellipse cx="10" cy="28" rx="1.5" ry="0.6" fill="#7a5520" opacity="0.5" />
      </pattern>
      <linearGradient id="wood-shade" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
      </linearGradient>

      {/* Plafon / gypsum — light cream with subtle pattern */}
      <pattern
        id="ceiling-tex"
        patternUnits="userSpaceOnUse"
        width="40"
        height="40"
      >
        <rect width="40" height="40" fill="#f5f1e6" />
        <line x1="0" y1="0" x2="40" y2="0" stroke="#c4b890" strokeWidth="0.4" />
        <line x1="0" y1="40" x2="40" y2="40" stroke="#c4b890" strokeWidth="0.4" />
        <line x1="0" y1="0" x2="0" y2="40" stroke="#c4b890" strokeWidth="0.4" />
        <line x1="40" y1="0" x2="40" y2="40" stroke="#c4b890" strokeWidth="0.4" />
      </pattern>

      {/* PVC pipe — gradient */}
      <linearGradient id="pipe-pvc" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#e8e8e8" />
        <stop offset="40%" stopColor="#bdbdbd" />
        <stop offset="100%" stopColor="#7a7a7a" />
      </linearGradient>

      {/* Rebar (besi tulangan) */}
      <linearGradient id="rebar" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#3a3a3a" />
        <stop offset="50%" stopColor="#1a1a1a" />
        <stop offset="100%" stopColor="#3a3a3a" />
      </linearGradient>

      {/* Arrow marker buat dimension lines */}
      <marker
        id="dim-arrow-start"
        viewBox="0 0 10 10"
        refX="2"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M0,0 L10,5 L0,10 z" fill="#525252" />
      </marker>
      <marker
        id="dim-arrow-end"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto"
      >
        <path d="M0,0 L10,5 L0,10 z" fill="#525252" />
      </marker>
    </defs>
  );
}

// Dimension label pakai background putih biar readable di atas pattern
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
  const w = text.length * 6 + 8;
  const offsetX = anchor === "start" ? 0 : anchor === "end" ? -w : -w / 2;
  return (
    <g>
      <rect
        x={x + offsetX}
        y={y - 9}
        width={w}
        height={13}
        rx="2"
        fill="#fafafa"
        stroke="#d4d4d4"
        strokeWidth="0.5"
      />
      <text
        x={x}
        y={y + 1}
        textAnchor={anchor}
        className="fill-foreground font-mono"
        style={{ fontSize: "10px", fontWeight: 600 }}
      >
        {text}
      </text>
    </g>
  );
}

function DimLine({
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
      stroke="#525252"
      strokeWidth="0.8"
      markerStart="url(#dim-arrow-start)"
      markerEnd="url(#dim-arrow-end)"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Pondasi Tapak / Galian — concrete footing dalam pit galian
// ─────────────────────────────────────────────────────────────────────────────

function FootingDiagram({
  pLabel,
  lLabel,
  tLabel,
}: {
  pLabel: string;
  lLabel: string;
  tLabel: string;
}) {
  // Pit dimensions
  const x0 = 60;
  const y0 = 200;
  const w = 220;
  const h = 90;
  const dx = 70;
  const dy = -45;

  // Earth (ground around pit) — area abstract
  const earthOuter = `${x0 - 30},${y0 + 30} ${x0 + w + 30},${y0 + 30} ${x0 + w + 30 + dx + 20},${y0 + 30 + dy - 10} ${x0 - 30 + dx + 20},${y0 + 30 + dy - 10}`;

  // Pit corners
  const fbl = { x: x0, y: y0 };
  const fbr = { x: x0 + w, y: y0 };
  const ftr = { x: x0 + w, y: y0 - h };
  const ftl = { x: x0, y: y0 - h };
  const bbl = { x: fbl.x + dx, y: fbl.y + dy };
  const bbr = { x: fbr.x + dx, y: fbr.y + dy };
  const btr = { x: ftr.x + dx, y: ftr.y + dy };
  const btl = { x: ftl.x + dx, y: ftl.y + dy };

  // Concrete footing inside (smaller, sits at bottom)
  const margin = 8;
  const cfbl = { x: fbl.x + margin, y: fbl.y };
  const cfbr = { x: fbr.x - margin, y: fbr.y };
  const cftr = { x: cfbr.x, y: cfbr.y - h * 0.55 };
  const cftl = { x: cfbl.x, y: cfbl.y - h * 0.55 };
  const cbbl = { x: cfbl.x + dx, y: cfbl.y + dy };
  const cbbr = { x: cfbr.x + dx, y: cfbr.y + dy };
  const cbtr = { x: cftr.x + dx, y: cftr.y + dy };
  const cbtl = { x: cftl.x + dx, y: cftl.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Ground level (earth around pit) */}
      <polygon points={earthOuter} fill="url(#earth-tex)" opacity="0.85" />

      {/* Pit walls — back (deepest) */}
      <polygon
        points={`${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="url(#earth-bottom)"
      />
      {/* Pit wall right */}
      <polygon
        points={`${ftr.x},${ftr.y} ${fbr.x},${fbr.y} ${bbr.x},${bbr.y} ${btr.x},${btr.y}`}
        fill="url(#earth-side)"
      />
      {/* Pit floor */}
      <polygon
        points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${bbr.x},${bbr.y} ${bbl.x},${bbl.y}`}
        fill="url(#earth-bottom)"
        opacity="0.95"
      />

      {/* Concrete footing inside pit — top face */}
      <polygon
        points={`${cftl.x},${cftl.y} ${cftr.x},${cftr.y} ${cbtr.x},${cbtr.y} ${cbtl.x},${cbtl.y}`}
        fill="url(#concrete-top)"
        stroke="#5d5d5d"
        strokeWidth="0.8"
      />
      {/* Concrete right side */}
      <polygon
        points={`${cftr.x},${cftr.y} ${cfbr.x},${cfbr.y} ${cbbr.x},${cbbr.y} ${cbtr.x},${cbtr.y}`}
        fill="url(#concrete-side)"
        stroke="#5d5d5d"
        strokeWidth="0.8"
      />
      {/* Concrete front face */}
      <polygon
        points={`${cfbl.x},${cfbl.y} ${cfbr.x},${cfbr.y} ${cftr.x},${cftr.y} ${cftl.x},${cftl.y}`}
        fill="url(#concrete-front)"
        stroke="#5d5d5d"
        strokeWidth="0.8"
      />

      {/* Rebar grid on top face — horizontal + vertical lines */}
      {[0.2, 0.4, 0.6, 0.8].map((p) => (
        <line
          key={`rh${p}`}
          x1={cftl.x + (cftr.x - cftl.x) * p}
          y1={cftl.y + (cftr.y - cftl.y) * p}
          x2={cbtl.x + (cbtr.x - cbtl.x) * p}
          y2={cbtl.y + (cbtr.y - cbtl.y) * p}
          stroke="#1a1a1a"
          strokeWidth="0.6"
          opacity="0.8"
        />
      ))}
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={`rv${p}`}
          x1={cftl.x + (cbtl.x - cftl.x) * p}
          y1={cftl.y + (cbtl.y - cftl.y) * p}
          x2={cftr.x + (cbtr.x - cftr.x) * p}
          y2={cftr.y + (cbtr.y - cftr.y) * p}
          stroke="#1a1a1a"
          strokeWidth="0.6"
          opacity="0.8"
        />
      ))}

      {/* Dimensions */}
      <DimLine
        x1={fbl.x}
        y1={fbl.y + 50}
        x2={fbr.x}
        y2={fbr.y + 50}
      />
      <DimLabel x={(fbl.x + fbr.x) / 2} y={fbl.y + 64} text={pLabel} />

      <DimLine
        x1={fbr.x + 16}
        y1={fbr.y + 8}
        x2={bbr.x + 16}
        y2={bbr.y + 8}
      />
      <DimLabel
        x={(fbr.x + bbr.x) / 2 + 28}
        y={(fbr.y + bbr.y) / 2 + 12}
        text={lLabel}
        anchor="start"
      />

      <DimLine x1={cfbl.x - 22} y1={cfbl.y} x2={cftl.x - 22} y2={cftl.y} />
      <DimLabel
        x={cfbl.x - 30}
        y={(cfbl.y + cftl.y) / 2 + 4}
        text={tLabel}
        anchor="end"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Sloof / Balok Beton — horizontal beam with rebar visible
// ─────────────────────────────────────────────────────────────────────────────

function BeamDiagram({
  pLabel,
  lLabel,
  tLabel,
}: {
  pLabel: string;
  lLabel: string;
  tLabel: string;
}) {
  const x0 = 60;
  const y0 = 180;
  const w = 240;
  const h = 70;
  const dx = 50;
  const dy = -32;

  const fbl = { x: x0, y: y0 };
  const fbr = { x: x0 + w, y: y0 };
  const ftr = { x: x0 + w, y: y0 - h };
  const ftl = { x: x0, y: y0 - h };
  const bbl = { x: fbl.x + dx, y: fbl.y + dy };
  const bbr = { x: fbr.x + dx, y: fbr.y + dy };
  const btr = { x: ftr.x + dx, y: ftr.y + dy };
  const btl = { x: ftl.x + dx, y: ftl.y + dy };

  // Cross-section (right end) — show rebar dots
  const rebarDots = [
    { x: ftr.x + 12, y: ftr.y + 14 }, // top-left rebar
    { x: ftr.x + dx - 12, y: ftr.y + dy + 14 }, // top-right rebar
    { x: fbr.x + 12, y: fbr.y - 14 }, // bottom-left rebar
    { x: fbr.x + dx - 12, y: fbr.y + dy - 14 }, // bottom-right rebar
  ];

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Top face */}
      <polygon
        points={`${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="url(#concrete-top)"
        stroke="#5d5d5d"
        strokeWidth="1"
      />
      {/* Right face (cross-section) */}
      <polygon
        points={`${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${bbr.x},${bbr.y}`}
        fill="url(#concrete-side)"
        stroke="#5d5d5d"
        strokeWidth="1"
      />
      {/* Front face */}
      <polygon
        points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${ftl.x},${ftl.y}`}
        fill="url(#concrete-front)"
        stroke="#5d5d5d"
        strokeWidth="1"
      />

      {/* Rebar dots on cross-section (right face) */}
      {rebarDots.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="url(#rebar)" />
          <circle cx={p.x - 0.7} cy={p.y - 0.7} r="0.9" fill="#7a7a7a" />
        </g>
      ))}

      {/* Stirrup outline (sengkang) on cross-section */}
      <rect
        x={ftr.x + 8}
        y={ftr.y + 10}
        width={dx - 16}
        height={h - 20}
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="0.7"
        strokeDasharray="0"
        transform={`skewY(${(Math.atan2(dy, dx) * 180) / Math.PI})`}
        style={{ transformOrigin: `${ftr.x + 8}px ${ftr.y + 10}px` }}
      />

      {/* Longitudinal rebar (visible through end as small extruded lines) */}
      {rebarDots.slice(0, 2).map((p, i) => (
        <line
          key={`lr${i}`}
          x1={p.x - dx + 4}
          y1={p.y - dy}
          x2={p.x}
          y2={p.y}
          stroke="#1a1a1a"
          strokeWidth="0.7"
          strokeDasharray="2 2"
          opacity="0.5"
        />
      ))}

      {/* Dimensions */}
      <DimLine x1={fbl.x} y1={fbl.y + 26} x2={fbr.x} y2={fbr.y + 26} />
      <DimLabel x={(fbl.x + fbr.x) / 2} y={fbl.y + 42} text={pLabel} />

      <DimLine x1={fbr.x + 16} y1={fbr.y + 6} x2={bbr.x + 16} y2={bbr.y + 6} />
      <DimLabel
        x={(fbr.x + bbr.x) / 2 + 28}
        y={(fbr.y + bbr.y) / 2 + 14}
        text={lLabel}
        anchor="start"
      />

      <DimLine x1={fbl.x - 18} y1={fbl.y} x2={ftl.x - 18} y2={ftl.y} />
      <DimLabel
        x={fbl.x - 26}
        y={(fbl.y + ftl.y) / 2 + 4}
        text={tLabel}
        anchor="end"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Kolom Beton — vertical column with rebar
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
  const w = 70;
  const h = 200;
  const dx = 32;
  const dy = -22;

  const fbl = { x: x0, y: y0 };
  const fbr = { x: x0 + w, y: y0 };
  const ftr = { x: x0 + w, y: y0 - h };
  const ftl = { x: x0, y: y0 - h };
  const bbl = { x: fbl.x + dx, y: fbl.y + dy };
  const bbr = { x: fbr.x + dx, y: fbr.y + dy };
  const btr = { x: ftr.x + dx, y: ftr.y + dy };
  const btl = { x: ftl.x + dx, y: ftl.y + dy };

  // Top face rebar (4 corners)
  const margin = 6;
  const topRebars = [
    { x: ftl.x + margin, y: ftl.y + margin * 0.6 },
    { x: ftr.x - margin, y: ftr.y + margin * 0.6 },
    { x: btr.x - margin, y: btr.y + margin * 0.6 },
    { x: btl.x + margin, y: btl.y + margin * 0.6 },
  ];

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Top face */}
      <polygon
        points={`${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="url(#concrete-top)"
        stroke="#5d5d5d"
        strokeWidth="1"
      />
      {/* Right face */}
      <polygon
        points={`${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${bbr.x},${bbr.y}`}
        fill="url(#concrete-side)"
        stroke="#5d5d5d"
        strokeWidth="1"
      />
      {/* Front face */}
      <polygon
        points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${ftl.x},${ftl.y}`}
        fill="url(#concrete-front)"
        stroke="#5d5d5d"
        strokeWidth="1"
      />

      {/* Stirrup hoops on front face — beberapa sengkang horizontal */}
      {[0.15, 0.3, 0.5, 0.7, 0.85].map((p) => (
        <line
          key={`st${p}`}
          x1={fbl.x + 2}
          y1={ftl.y + h * p}
          x2={fbr.x - 2}
          y2={ftr.y + h * p}
          stroke="#1a1a1a"
          strokeWidth="0.6"
          opacity="0.4"
        />
      ))}

      {/* Top face rebar dots */}
      {topRebars.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="url(#rebar)" />
          <circle cx={p.x - 0.6} cy={p.y - 0.6} r="0.7" fill="#7a7a7a" />
        </g>
      ))}

      {/* Stirrup outline on top face */}
      <polygon
        points={topRebars.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="0.7"
      />

      {/* Dimensions */}
      <DimLine x1={fbl.x - 18} y1={fbl.y} x2={ftl.x - 18} y2={ftl.y} />
      <DimLabel
        x={fbl.x - 26}
        y={(fbl.y + ftl.y) / 2 + 4}
        text={heightLabel}
        anchor="end"
      />

      <DimLine x1={fbl.x} y1={fbl.y + 22} x2={fbr.x} y2={fbr.y + 22} />
      <DimLabel x={(fbl.x + fbr.x) / 2} y={fbl.y + 38} text={sideLabel} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Plat Lantai — flat slab from above-perspective
// ─────────────────────────────────────────────────────────────────────────────

function SlabDiagram({
  pLabel,
  lLabel,
  tLabel,
}: {
  pLabel: string;
  lLabel: string;
  tLabel: string;
}) {
  const x0 = 70;
  const y0 = 200;
  const w = 240;
  const h = 30; // tebal (thin)
  const dx = 60;
  const dy = -50;

  const fbl = { x: x0, y: y0 };
  const fbr = { x: x0 + w, y: y0 };
  const ftr = { x: x0 + w, y: y0 - h };
  const ftl = { x: x0, y: y0 - h };
  const bbl = { x: fbl.x + dx, y: fbl.y + dy };
  const bbr = { x: fbr.x + dx, y: fbr.y + dy };
  const btr = { x: ftr.x + dx, y: ftr.y + dy };
  const btl = { x: ftl.x + dx, y: ftl.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Top face (most visible) */}
      <polygon
        points={`${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="url(#concrete-top)"
        stroke="#5d5d5d"
        strokeWidth="1"
      />
      {/* Rebar grid on top */}
      {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((p) => (
        <line
          key={`g${p}`}
          x1={ftl.x + (ftr.x - ftl.x) * p}
          y1={ftl.y + (ftr.y - ftl.y) * p}
          x2={btl.x + (btr.x - btl.x) * p}
          y2={btl.y + (btr.y - btl.y) * p}
          stroke="#1a1a1a"
          strokeWidth="0.5"
          opacity="0.45"
        />
      ))}
      {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((p) => (
        <line
          key={`g2${p}`}
          x1={ftl.x + (btl.x - ftl.x) * p}
          y1={ftl.y + (btl.y - ftl.y) * p}
          x2={ftr.x + (btr.x - ftr.x) * p}
          y2={ftr.y + (btr.y - ftr.y) * p}
          stroke="#1a1a1a"
          strokeWidth="0.5"
          opacity="0.4"
        />
      ))}

      {/* Right edge */}
      <polygon
        points={`${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${bbr.x},${bbr.y}`}
        fill="url(#concrete-side)"
        stroke="#5d5d5d"
        strokeWidth="1"
      />
      {/* Front edge (shows tebal) */}
      <polygon
        points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${ftl.x},${ftl.y}`}
        fill="url(#concrete-front)"
        stroke="#5d5d5d"
        strokeWidth="1"
      />

      {/* Dimensions */}
      <DimLine x1={fbl.x} y1={fbl.y + 22} x2={fbr.x} y2={fbr.y + 22} />
      <DimLabel x={(fbl.x + fbr.x) / 2} y={fbl.y + 38} text={pLabel} />

      <DimLine x1={fbr.x + 14} y1={fbr.y + 4} x2={bbr.x + 14} y2={bbr.y + 4} />
      <DimLabel
        x={(fbr.x + bbr.x) / 2 + 26}
        y={(fbr.y + bbr.y) / 2 + 12}
        text={lLabel}
        anchor="start"
      />

      <DimLine x1={fbl.x - 18} y1={fbl.y} x2={ftl.x - 18} y2={ftl.y} />
      <DimLabel
        x={fbl.x - 26}
        y={(fbl.y + ftl.y) / 2 + 4}
        text={tLabel}
        anchor="end"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Pasangan Dinding — brick wall with door + window openings
// ─────────────────────────────────────────────────────────────────────────────

function BrickWallDiagram({
  pLabel,
  tLabel,
  bukaanText,
}: {
  pLabel: string;
  tLabel: string;
  bukaanText?: string;
}) {
  const x0 = 70;
  const y0 = 220;
  const w = 240;
  const h = 140;
  const dx = 28;
  const dy = -22;

  const fbl = { x: x0, y: y0 };
  const fbr = { x: x0 + w, y: y0 };
  const ftr = { x: x0 + w, y: y0 - h };
  const ftl = { x: x0, y: y0 - h };
  const bbl = { x: fbl.x + dx, y: fbl.y + dy };
  const btl = { x: ftl.x + dx, y: ftl.y + dy };
  const btr = { x: ftr.x + dx, y: ftr.y + dy };
  const bbr = { x: fbr.x + dx, y: fbr.y + dy };

  // Window on front face
  const winX = x0 + 50;
  const winY = y0 - 100;
  const winW = 50;
  const winH = 50;

  // Door on front face
  const doorX = x0 + 165;
  const doorY = y0 - 100;
  const doorW = 36;
  const doorH = 100;

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Top of wall (tebal visible) */}
      <polygon
        points={`${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="#a8a8a8"
        stroke="#5d5d5d"
        strokeWidth="0.8"
      />
      {/* Right face (tebal) */}
      <polygon
        points={`${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${bbr.x},${bbr.y}`}
        fill="#777"
        stroke="#5d5d5d"
        strokeWidth="0.8"
      />
      {/* Front face — brick pattern */}
      <polygon
        points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${ftl.x},${ftl.y}`}
        fill="url(#brick-tex)"
      />
      {/* Subtle shading overlay on front */}
      <polygon
        points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${ftl.x},${ftl.y}`}
        fill="url(#brick-shade)"
      />

      {/* Window opening — recessed */}
      <rect
        x={winX}
        y={winY}
        width={winW}
        height={winH}
        fill="#3d4a5a"
        stroke="#1a1a1a"
        strokeWidth="0.8"
      />
      <rect
        x={winX + 2}
        y={winY + 2}
        width={winW - 4}
        height={winH - 4}
        fill="#7593b8"
        opacity="0.7"
      />
      {/* Window mullions */}
      <line
        x1={winX + winW / 2}
        y1={winY + 2}
        x2={winX + winW / 2}
        y2={winY + winH - 2}
        stroke="#3d4a5a"
        strokeWidth="1.5"
      />
      <line
        x1={winX + 2}
        y1={winY + winH / 2}
        x2={winX + winW - 2}
        y2={winY + winH / 2}
        stroke="#3d4a5a"
        strokeWidth="1.5"
      />

      {/* Door opening */}
      <rect
        x={doorX}
        y={doorY}
        width={doorW}
        height={doorH}
        fill="#5d4a26"
        stroke="#1a1a1a"
        strokeWidth="0.8"
      />
      <rect
        x={doorX + 2}
        y={doorY + 2}
        width={doorW - 4}
        height={doorH - 4}
        fill="#8b6f3d"
      />
      {/* Door handle */}
      <circle
        cx={doorX + doorW - 6}
        cy={doorY + doorH / 2}
        r="1.5"
        fill="#fbbf24"
      />
      {/* Door panels */}
      <rect
        x={doorX + 4}
        y={doorY + 8}
        width={doorW - 8}
        height={36}
        fill="none"
        stroke="#5d4a26"
        strokeWidth="0.8"
      />
      <rect
        x={doorX + 4}
        y={doorY + 50}
        width={doorW - 8}
        height={42}
        fill="none"
        stroke="#5d4a26"
        strokeWidth="0.8"
      />

      {/* Dimensions */}
      <DimLine x1={fbl.x} y1={fbl.y + 22} x2={fbr.x} y2={fbr.y + 22} />
      <DimLabel x={(fbl.x + fbr.x) / 2} y={fbl.y + 38} text={pLabel} />

      <DimLine x1={fbl.x - 18} y1={fbl.y} x2={ftl.x - 18} y2={ftl.y} />
      <DimLabel
        x={fbl.x - 26}
        y={(fbl.y + ftl.y) / 2 + 4}
        text={tLabel}
        anchor="end"
      />

      {bukaanText && (
        <g>
          <line
            x1={winX + winW + 2}
            y1={winY + winH / 2}
            x2={doorX - 2}
            y2={doorY + 12}
            stroke="#dc2626"
            strokeWidth="0.8"
            strokeDasharray="3 2"
            opacity="0.7"
          />
          <DimLabel
            x={x0 + w / 2}
            y={y0 + 58}
            text={bukaanText}
            anchor="middle"
          />
        </g>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Plesteran — wall with plaster layer being applied
// ─────────────────────────────────────────────────────────────────────────────

function PlasterWallDiagram({
  pLabel,
  tLabel,
  sisiText,
}: {
  pLabel: string;
  tLabel: string;
  sisiText: string;
}) {
  const x0 = 70;
  const y0 = 220;
  const w = 240;
  const h = 140;
  const dx = 28;
  const dy = -22;

  const fbl = { x: x0, y: y0 };
  const fbr = { x: x0 + w, y: y0 };
  const ftr = { x: x0 + w, y: y0 - h };
  const ftl = { x: x0, y: y0 - h };
  const btl = { x: ftl.x + dx, y: ftl.y + dy };
  const btr = { x: ftr.x + dx, y: ftr.y + dy };
  const bbr = { x: fbr.x + dx, y: fbr.y + dy };

  // Half-cutaway: kiri masih bata, kanan udah plesteran
  const splitX = x0 + w * 0.5;

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Top face */}
      <polygon
        points={`${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="url(#plaster-side)"
        stroke="#5d5d5d"
        strokeWidth="0.8"
      />
      {/* Right face */}
      <polygon
        points={`${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${bbr.x},${bbr.y}`}
        fill="url(#plaster-side)"
        stroke="#5d5d5d"
        strokeWidth="0.8"
      />

      {/* Left half front face — bricks (un-plastered) */}
      <polygon
        points={`${fbl.x},${fbl.y} ${splitX},${fbl.y} ${splitX},${ftl.y} ${ftl.x},${ftl.y}`}
        fill="url(#brick-tex)"
      />
      {/* Right half front face — plaster (smooth) */}
      <polygon
        points={`${splitX},${fbl.y} ${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${splitX},${ftl.y}`}
        fill="url(#plaster-front)"
        stroke="#7a6c4d"
        strokeWidth="0.4"
      />
      {/* Plaster trowel marks (subtle texture lines) */}
      {[0.2, 0.4, 0.6, 0.8].map((p) => (
        <line
          key={`tm${p}`}
          x1={splitX + (fbr.x - splitX) * 0.1}
          y1={ftl.y + h * p}
          x2={splitX + (fbr.x - splitX) * 0.9}
          y2={ftl.y + h * p + 2}
          stroke="#a99a78"
          strokeWidth="0.4"
          opacity="0.5"
        />
      ))}
      {/* Vertical separator showing transition */}
      <line
        x1={splitX}
        y1={fbl.y}
        x2={splitX}
        y2={ftl.y}
        stroke="#7a6c4d"
        strokeWidth="1"
        strokeDasharray="3 2"
      />

      {/* Trowel tool indicator */}
      <g transform={`translate(${splitX + 15}, ${ftl.y + 30}) rotate(-20)`}>
        <rect
          x="0"
          y="0"
          width="22"
          height="6"
          fill="#a3a3a3"
          stroke="#525252"
          strokeWidth="0.6"
        />
        <rect
          x="22"
          y="1"
          width="10"
          height="4"
          fill="#7a3d28"
        />
      </g>

      {/* Dimensions */}
      <DimLine x1={fbl.x} y1={fbl.y + 22} x2={fbr.x} y2={fbr.y + 22} />
      <DimLabel x={(fbl.x + fbr.x) / 2} y={fbl.y + 38} text={pLabel} />

      <DimLine x1={fbl.x - 18} y1={fbl.y} x2={ftl.x - 18} y2={ftl.y} />
      <DimLabel
        x={fbl.x - 26}
        y={(fbl.y + ftl.y) / 2 + 4}
        text={tLabel}
        anchor="end"
      />

      {/* Sisi label */}
      <g>
        <rect
          x={x0 + w / 2 - 30}
          y={y0 + 48}
          width="60"
          height="16"
          rx="3"
          fill="#fef3c7"
          stroke="#d97706"
          strokeWidth="0.6"
        />
        <text
          x={x0 + w / 2}
          y={y0 + 58}
          textAnchor="middle"
          className="font-mono"
          fill="#92400e"
          style={{ fontSize: "11px", fontWeight: 700 }}
        >
          {sisiText}
        </text>
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Pondasi Batu Kali / Rollag — trapezoidal stone foundation
// ─────────────────────────────────────────────────────────────────────────────

function TrapezoidFoundationDiagram({
  pLabel,
  aLabel,
  bLabel,
  tLabel,
}: {
  pLabel: string;
  aLabel: string;
  bLabel: string;
  tLabel: string;
}) {
  // Cross-section view: trapezoid (bottom wider than top)
  // Front face shows trapezoid; perspective extends to depth (panjang)
  const cx = 100; // center bottom-front
  const yBase = 230;
  const topW = 70; // a (atas)
  const botW = 130; // b (bawah)
  const h = 110; // T (tinggi)
  const dx = 110; // depth = panjang
  const dy = -50;

  // Front trapezoid (cross section)
  const flBot = { x: cx - botW / 2, y: yBase };
  const frBot = { x: cx + botW / 2, y: yBase };
  const frTop = { x: cx + topW / 2, y: yBase - h };
  const flTop = { x: cx - topW / 2, y: yBase - h };

  // Back trapezoid
  const blBot = { x: flBot.x + dx, y: flBot.y + dy };
  const brBot = { x: frBot.x + dx, y: frBot.y + dy };
  const brTop = { x: frTop.x + dx, y: frTop.y + dy };
  const blTop = { x: flTop.x + dx, y: flTop.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Top face */}
      <polygon
        points={`${flTop.x},${flTop.y} ${frTop.x},${frTop.y} ${brTop.x},${brTop.y} ${blTop.x},${blTop.y}`}
        fill="#9a9085"
        stroke="#3d362e"
        strokeWidth="0.8"
      />
      {/* Right slanted face */}
      <polygon
        points={`${frBot.x},${frBot.y} ${frTop.x},${frTop.y} ${brTop.x},${brTop.y} ${brBot.x},${brBot.y}`}
        fill="url(#stone-tex)"
        stroke="#3d362e"
        strokeWidth="0.8"
      />
      <polygon
        points={`${frBot.x},${frBot.y} ${frTop.x},${frTop.y} ${brTop.x},${brTop.y} ${brBot.x},${brBot.y}`}
        fill="rgba(0,0,0,0.2)"
      />
      {/* Front face — trapezoid */}
      <polygon
        points={`${flBot.x},${flBot.y} ${frBot.x},${frBot.y} ${frTop.x},${frTop.y} ${flTop.x},${flTop.y}`}
        fill="url(#stone-tex)"
        stroke="#3d362e"
        strokeWidth="1"
      />

      {/* Dimensions */}
      {/* a (top) */}
      <DimLine x1={flTop.x} y1={flTop.y - 14} x2={frTop.x} y2={frTop.y - 14} />
      <DimLabel x={(flTop.x + frTop.x) / 2} y={flTop.y - 18} text={aLabel} />

      {/* b (bottom) */}
      <DimLine x1={flBot.x} y1={flBot.y + 22} x2={frBot.x} y2={frBot.y + 22} />
      <DimLabel x={(flBot.x + frBot.x) / 2} y={flBot.y + 38} text={bLabel} />

      {/* T (height, kiri) */}
      <DimLine x1={flBot.x - 18} y1={flBot.y} x2={flTop.x - 18} y2={flTop.y} />
      <DimLabel
        x={flBot.x - 26}
        y={(flBot.y + flTop.y) / 2 + 4}
        text={tLabel}
        anchor="end"
      />

      {/* P (panjang/depth) */}
      <DimLine x1={frBot.x + 12} y1={frBot.y + 4} x2={brBot.x + 12} y2={brBot.y + 4} />
      <DimLabel
        x={(frBot.x + brBot.x) / 2 + 24}
        y={(frBot.y + brBot.y) / 2 + 12}
        text={pLabel}
        anchor="start"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Galian Saluran / Parit — long trench
// ─────────────────────────────────────────────────────────────────────────────

function TrenchDiagram({
  pLabel,
  lLabel,
  tLabel,
}: {
  pLabel: string;
  lLabel: string;
  tLabel: string;
}) {
  // Long trench view from oblique angle
  const x0 = 50;
  const y0 = 200;
  const w = 270; // panjang (long)
  const h = 60; // kedalaman
  const dx = 30; // lebar (sempit)
  const dy = -22;

  const fbl = { x: x0, y: y0 };
  const fbr = { x: x0 + w, y: y0 };
  const ftr = { x: x0 + w, y: y0 - h };
  const ftl = { x: x0, y: y0 - h };
  const bbl = { x: fbl.x + dx, y: fbl.y + dy };
  const bbr = { x: fbr.x + dx, y: fbr.y + dy };
  const btr = { x: ftr.x + dx, y: ftr.y + dy };
  const btl = { x: ftl.x + dx, y: ftl.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Surrounding earth (around trench) */}
      <rect
        x={x0 - 30}
        y={y0}
        width={w + 80}
        height="60"
        fill="url(#earth-tex)"
        opacity="0.7"
      />
      <polygon
        points={`${x0 - 30},${y0} ${x0 + w + 50},${y0} ${x0 + w + 50 + dx + 5},${y0 + dy - 5} ${x0 - 30 + dx + 5},${y0 + dy - 5}`}
        fill="url(#earth-tex)"
        opacity="0.85"
      />

      {/* Trench right wall (cross-section) */}
      <polygon
        points={`${ftr.x},${ftr.y} ${fbr.x},${fbr.y} ${bbr.x},${bbr.y} ${btr.x},${btr.y}`}
        fill="url(#earth-side)"
      />
      {/* Trench back wall */}
      <polygon
        points={`${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="url(#earth-bottom)"
      />
      {/* Trench floor */}
      <polygon
        points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${bbr.x},${bbr.y} ${bbl.x},${bbl.y}`}
        fill="url(#earth-bottom)"
        opacity="0.95"
      />
      {/* Trench front wall */}
      <polygon
        points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${ftl.x},${ftl.y}`}
        fill="url(#earth-side)"
        stroke="#4d3a1f"
        strokeWidth="1"
      />

      {/* Dimensions */}
      <DimLine x1={fbl.x} y1={fbl.y + 38} x2={fbr.x} y2={fbr.y + 38} />
      <DimLabel x={(fbl.x + fbr.x) / 2} y={fbl.y + 54} text={pLabel} />

      <DimLine x1={fbr.x + 12} y1={fbr.y + 4} x2={bbr.x + 12} y2={bbr.y + 4} />
      <DimLabel
        x={(fbr.x + bbr.x) / 2 + 24}
        y={(fbr.y + bbr.y) / 2 + 12}
        text={lLabel}
        anchor="start"
      />

      <DimLine x1={fbl.x - 18} y1={fbl.y} x2={ftl.x - 18} y2={ftl.y} />
      <DimLabel
        x={fbl.x - 26}
        y={(fbl.y + ftl.y) / 2 + 4}
        text={tLabel}
        anchor="end"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Timbunan / Pemadatan — layered earth fill
// ─────────────────────────────────────────────────────────────────────────────

function FillDiagram({
  pLabel,
  lLabel,
  tLabel,
}: {
  pLabel: string;
  lLabel: string;
  tLabel: string;
}) {
  const x0 = 60;
  const y0 = 220;
  const w = 250;
  const h = 90;
  const dx = 60;
  const dy = -40;

  const fbl = { x: x0, y: y0 };
  const fbr = { x: x0 + w, y: y0 };
  const ftr = { x: x0 + w, y: y0 - h };
  const ftl = { x: x0, y: y0 - h };
  const bbr = { x: fbr.x + dx, y: fbr.y + dy };
  const btr = { x: ftr.x + dx, y: ftr.y + dy };
  const btl = { x: ftl.x + dx, y: ftl.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Top face — compacted */}
      <polygon
        points={`${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="url(#compact-earth)"
        stroke="#5e4724"
        strokeWidth="0.8"
      />
      {/* Right face */}
      <polygon
        points={`${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${bbr.x},${bbr.y}`}
        fill="url(#earth-side)"
        stroke="#4d3a1f"
        strokeWidth="0.8"
      />
      {/* Front face — show layers */}
      <polygon
        points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${ftl.x},${ftl.y}`}
        fill="url(#earth-side)"
        stroke="#4d3a1f"
        strokeWidth="0.8"
      />
      {/* Compaction layers (horizontal lines on front) */}
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={fbl.x}
          y1={fbl.y - h * p}
          x2={fbr.x}
          y2={fbr.y - h * p}
          stroke="#3e2c14"
          strokeWidth="0.6"
          strokeDasharray="4 2"
          opacity="0.7"
        />
      ))}

      {/* Compactor roller hint at top-right corner */}
      <g transform={`translate(${ftr.x - 25}, ${ftr.y - 14})`}>
        <rect x="0" y="0" width="24" height="10" fill="#fbbf24" stroke="#92400e" strokeWidth="0.6" rx="2" />
        <circle cx="6" cy="14" r="3.5" fill="#1a1a1a" stroke="#525252" strokeWidth="0.5" />
        <circle cx="18" cy="14" r="3.5" fill="#1a1a1a" stroke="#525252" strokeWidth="0.5" />
      </g>

      {/* Dimensions */}
      <DimLine x1={fbl.x} y1={fbl.y + 24} x2={fbr.x} y2={fbr.y + 24} />
      <DimLabel x={(fbl.x + fbr.x) / 2} y={fbl.y + 40} text={pLabel} />

      <DimLine x1={fbr.x + 12} y1={fbr.y + 4} x2={bbr.x + 12} y2={bbr.y + 4} />
      <DimLabel
        x={(fbr.x + bbr.x) / 2 + 24}
        y={(fbr.y + bbr.y) / 2 + 12}
        text={lLabel}
        anchor="start"
      />

      <DimLine x1={fbl.x - 18} y1={fbl.y} x2={ftl.x - 18} y2={ftl.y} />
      <DimLabel
        x={fbl.x - 26}
        y={(fbl.y + ftl.y) / 2 + 4}
        text={tLabel}
        anchor="end"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Atap (Sloped Roof) — gable roof with tile pattern
// ─────────────────────────────────────────────────────────────────────────────

function RoofDiagram({
  pLabel,
  lLabel,
  sudutLabel,
}: {
  pLabel: string;
  lLabel: string;
  sudutLabel: string;
}) {
  // Gable roof: 2 sloped faces meeting at ridge
  const x0 = 60;
  const yBase = 230;
  const w = 240; // panjang
  const halfL = 70; // setengah lebar (sisi miring)
  const ridgeH = 60; // tinggi puncak
  const dx = 30; // perspective shift
  const dy = -20;

  // Gable triangular ends
  const flBot = { x: x0, y: yBase };
  const flTop = { x: x0 + halfL / 2, y: yBase - ridgeH };
  const flRight = { x: x0 + halfL, y: yBase };

  const frBot = { x: x0 + w + dx, y: yBase + dy };
  const frTop = { x: x0 + w + dx + halfL / 2, y: yBase + dy - ridgeH };
  const frRight = { x: x0 + w + dx + halfL, y: yBase + dy };

  // Side roof faces (left slope and right slope of gable)
  // Left slope (facing viewer)
  const leftBot1 = flBot;
  const leftRidge1 = flTop;
  const leftRidge2 = frTop;
  const leftBot2 = frBot;

  // Right slope (back side, partially visible)
  const rightBot1 = flRight;
  const rightRidge1 = flTop;
  const rightRidge2 = frTop;
  const rightBot2 = frRight;

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Gable end (front - left triangular) */}
      <polygon
        points={`${flBot.x},${flBot.y} ${flRight.x},${flRight.y} ${flTop.x},${flTop.y}`}
        fill="#e8dfcd"
        stroke="#7a6c4d"
        strokeWidth="0.8"
      />
      {/* Right slope (back side, slightly darker) */}
      <polygon
        points={`${rightBot1.x},${rightBot1.y} ${rightBot2.x},${rightBot2.y} ${rightRidge2.x},${rightRidge2.y} ${rightRidge1.x},${rightRidge1.y}`}
        fill="url(#tile-roof)"
        stroke="#7a2410"
        strokeWidth="0.8"
      />
      <polygon
        points={`${rightBot1.x},${rightBot1.y} ${rightBot2.x},${rightBot2.y} ${rightRidge2.x},${rightRidge2.y} ${rightRidge1.x},${rightRidge1.y}`}
        fill="rgba(0,0,0,0.2)"
      />
      {/* Left slope (front - main visible) */}
      <polygon
        points={`${leftBot1.x},${leftBot1.y} ${leftBot2.x},${leftBot2.y} ${leftRidge2.x},${leftRidge2.y} ${leftRidge1.x},${leftRidge1.y}`}
        fill="url(#tile-roof)"
        stroke="#7a2410"
        strokeWidth="1"
      />
      {/* Ridge cap (puncak) */}
      <line
        x1={flTop.x}
        y1={flTop.y}
        x2={frTop.x}
        y2={frTop.y}
        stroke="#5a1c0a"
        strokeWidth="3"
      />

      {/* Back gable end (peek behind) */}
      <polygon
        points={`${frBot.x},${frBot.y} ${frRight.x},${frRight.y} ${frTop.x},${frTop.y}`}
        fill="#bdaf8e"
        stroke="#7a6c4d"
        strokeWidth="0.6"
      />

      {/* Angle indicator on front gable */}
      <path
        d={`M ${flBot.x + 18} ${flBot.y} A 18 18 0 0 0 ${flBot.x + 16} ${flBot.y - 8}`}
        fill="none"
        stroke="#dc2626"
        strokeWidth="1"
      />
      <text
        x={flBot.x + 24}
        y={flBot.y - 4}
        className="font-mono"
        fill="#dc2626"
        style={{ fontSize: "9px", fontWeight: 600 }}
      >
        {sudutLabel}
      </text>

      {/* Dimensions */}
      <DimLine x1={leftBot1.x} y1={leftBot1.y + 20} x2={leftBot2.x} y2={leftBot2.y + 20} />
      <DimLabel
        x={(leftBot1.x + leftBot2.x) / 2}
        y={(leftBot1.y + leftBot2.y) / 2 + 36}
        text={pLabel}
      />

      <DimLine x1={flBot.x - 16} y1={flBot.y + 4} x2={flRight.x - 4} y2={flRight.y + 16} />
      <DimLabel
        x={flBot.x + halfL / 2}
        y={flBot.y + 32}
        text={lLabel}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Lantai Keramik — top-down floor with tile grid
// ─────────────────────────────────────────────────────────────────────────────

function FloorTileDiagram({
  pLabel,
  lLabel,
  bukaanText,
}: {
  pLabel: string;
  lLabel: string;
  bukaanText?: string;
}) {
  // Top-down isometric view of floor
  const x0 = 70;
  const y0 = 210;
  const w = 240;
  const dx = 80;
  const dy = -100;
  const h = 0; // no height (floor)

  const fbl = { x: x0, y: y0 };
  const fbr = { x: x0 + w, y: y0 };
  const btl = { x: fbl.x + dx, y: fbl.y + dy };
  const btr = { x: fbr.x + dx, y: fbr.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Floor surface */}
      <polygon
        points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="url(#floor-tile)"
        stroke="#7a6c4d"
        strokeWidth="1"
      />

      {/* Subtle grid distortion to fake perspective: draw tile grid overlay */}
      {[0.2, 0.4, 0.6, 0.8].map((p) => (
        <line
          key={`tx${p}`}
          x1={fbl.x + (fbr.x - fbl.x) * p}
          y1={fbl.y}
          x2={btl.x + (btr.x - btl.x) * p}
          y2={btl.y}
          stroke="#a3997a"
          strokeWidth="0.4"
          opacity="0.7"
        />
      ))}
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={`ty${p}`}
          x1={fbl.x + (btl.x - fbl.x) * p}
          y1={fbl.y + (btl.y - fbl.y) * p}
          x2={fbr.x + (btr.x - fbr.x) * p}
          y2={fbr.y + (btr.y - fbr.y) * p}
          stroke="#a3997a"
          strokeWidth="0.4"
          opacity="0.7"
        />
      ))}

      {/* Dimensions */}
      <DimLine x1={fbl.x} y1={fbl.y + 18} x2={fbr.x} y2={fbr.y + 18} />
      <DimLabel x={(fbl.x + fbr.x) / 2} y={fbl.y + 34} text={pLabel} />

      <DimLine x1={fbr.x + 12} y1={fbr.y - 4} x2={btr.x + 12} y2={btr.y - 4} />
      <DimLabel
        x={(fbr.x + btr.x) / 2 + 24}
        y={(fbr.y + btr.y) / 2 + 4}
        text={lLabel}
        anchor="start"
      />

      {bukaanText && (
        <DimLabel
          x={(fbl.x + fbr.x) / 2}
          y={fbl.y + 56}
          text={bukaanText}
        />
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Cat Dinding — wall with paint roller
// ─────────────────────────────────────────────────────────────────────────────

function PaintWallDiagram({
  pLabel,
  tLabel,
  sisiText,
}: {
  pLabel: string;
  tLabel: string;
  sisiText: string;
}) {
  const x0 = 70;
  const y0 = 220;
  const w = 240;
  const h = 140;
  const dx = 28;
  const dy = -22;

  const fbl = { x: x0, y: y0 };
  const fbr = { x: x0 + w, y: y0 };
  const ftr = { x: x0 + w, y: y0 - h };
  const ftl = { x: x0, y: y0 - h };
  const btl = { x: ftl.x + dx, y: ftl.y + dy };
  const btr = { x: ftr.x + dx, y: ftr.y + dy };
  const bbr = { x: fbr.x + dx, y: fbr.y + dy };

  // Half painted (left = freshly painted blue, right = un-painted plaster)
  const splitX = x0 + w * 0.5;

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Top face */}
      <polygon
        points={`${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="url(#plaster-side)"
        stroke="#5d5d5d"
        strokeWidth="0.8"
      />
      {/* Right face */}
      <polygon
        points={`${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${bbr.x},${bbr.y}`}
        fill="url(#plaster-side)"
        stroke="#5d5d5d"
        strokeWidth="0.8"
      />
      {/* Left half — painted (light blue) */}
      <polygon
        points={`${fbl.x},${fbl.y} ${splitX},${fbl.y} ${splitX},${ftl.y} ${ftl.x},${ftl.y}`}
        fill="#a8c8e8"
        stroke="#5d7a99"
        strokeWidth="0.6"
      />
      {/* Paint streaks on painted side */}
      {[0.15, 0.35, 0.55, 0.75].map((p) => (
        <line
          key={p}
          x1={fbl.x + 4}
          y1={ftl.y + h * p}
          x2={splitX - 4}
          y2={ftl.y + h * p + 1}
          stroke="#7593b8"
          strokeWidth="0.5"
          opacity="0.5"
        />
      ))}
      {/* Right half — un-painted plaster */}
      <polygon
        points={`${splitX},${fbl.y} ${fbr.x},${fbr.y} ${ftr.x},${ftr.y} ${splitX},${ftl.y}`}
        fill="url(#plaster-front)"
        stroke="#7a6c4d"
        strokeWidth="0.6"
      />
      {/* Vertical separator */}
      <line
        x1={splitX}
        y1={fbl.y}
        x2={splitX}
        y2={ftl.y}
        stroke="#5d7a99"
        strokeWidth="1"
      />

      {/* Paint roller indicator at split */}
      <g transform={`translate(${splitX - 8}, ${ftl.y + 60})`}>
        <rect x="0" y="0" width="22" height="8" fill="#a8c8e8" stroke="#3d5a7a" strokeWidth="0.6" rx="3" />
        <line x1="22" y1="4" x2="34" y2="4" stroke="#525252" strokeWidth="2" />
        <rect x="34" y="2" width="4" height="4" fill="#7a3d28" />
      </g>
      {/* Paint drip */}
      <path
        d={`M ${splitX - 4} ${ftl.y + 75} L ${splitX - 4} ${ftl.y + 95} L ${splitX - 6} ${ftl.y + 100} L ${splitX - 2} ${ftl.y + 100} L ${splitX - 4} ${ftl.y + 95}`}
        fill="#7593b8"
        opacity="0.8"
      />

      {/* Dimensions */}
      <DimLine x1={fbl.x} y1={fbl.y + 22} x2={fbr.x} y2={fbr.y + 22} />
      <DimLabel x={(fbl.x + fbr.x) / 2} y={fbl.y + 38} text={pLabel} />

      <DimLine x1={fbl.x - 18} y1={fbl.y} x2={ftl.x - 18} y2={ftl.y} />
      <DimLabel
        x={fbl.x - 26}
        y={(fbl.y + ftl.y) / 2 + 4}
        text={tLabel}
        anchor="end"
      />

      {/* Sisi label */}
      <g>
        <rect
          x={x0 + w / 2 - 30}
          y={y0 + 48}
          width="60"
          height="16"
          rx="3"
          fill="#dbeafe"
          stroke="#2563eb"
          strokeWidth="0.6"
        />
        <text
          x={x0 + w / 2}
          y={y0 + 58}
          textAnchor="middle"
          className="font-mono"
          fill="#1e3a8a"
          style={{ fontSize: "11px", fontWeight: 700 }}
        >
          {sisiText}
        </text>
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Bekisting Kolom — concrete column wrapped in wood formwork
// ─────────────────────────────────────────────────────────────────────────────

function FormworkColumnDiagram({
  sLabel,
  tLabel,
}: {
  sLabel: string;
  tLabel: string;
}) {
  const x0 = 130;
  const y0 = 240;
  const w = 70;
  const h = 200;
  const dx = 32;
  const dy = -22;

  // Outer formwork (slightly larger)
  const pad = 5;
  const ofbl = { x: x0 - pad, y: y0 + pad };
  const ofbr = { x: x0 + w + pad, y: y0 + pad };
  const oftr = { x: x0 + w + pad, y: y0 - h };
  const oftl = { x: x0 - pad, y: y0 - h };
  const obtl = { x: oftl.x + dx, y: oftl.y + dy };
  const obtr = { x: oftr.x + dx, y: oftr.y + dy };

  // Inner concrete (peeking at top)
  const ftl = { x: x0, y: y0 - h + 4 };
  const ftr = { x: x0 + w, y: y0 - h + 4 };
  const btl = { x: ftl.x + dx, y: ftl.y + dy };
  const btr = { x: ftr.x + dx, y: ftr.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />
      {/* Top opening — concrete visible inside */}
      <polygon
        points={`${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="url(#concrete-top)"
        stroke="#5d5d5d"
        strokeWidth="0.6"
      />
      {/* Right wood face */}
      <polygon
        points={`${ofbr.x},${ofbr.y} ${oftr.x},${oftr.y} ${obtr.x},${obtr.y} ${obtr.x - dx + dx},${obtr.y - dy + dy}`}
        fill="url(#wood-tex)"
        stroke="#5d4a26"
        strokeWidth="0.8"
      />
      <polygon
        points={`${ofbr.x},${ofbr.y} ${oftr.x},${oftr.y} ${obtr.x},${obtr.y} ${ofbr.x + dx},${ofbr.y + dy}`}
        fill="url(#wood-shade)"
      />
      {/* Front wood face */}
      <polygon
        points={`${ofbl.x},${ofbl.y} ${ofbr.x},${ofbr.y} ${oftr.x},${oftr.y} ${oftl.x},${oftl.y}`}
        fill="url(#wood-tex)"
        stroke="#5d4a26"
        strokeWidth="1"
      />

      {/* Horizontal sabuk (yokes) — papan horizontal mengikat formwork */}
      {[0.15, 0.35, 0.55, 0.75, 0.92].map((p) => (
        <rect
          key={p}
          x={ofbl.x - 2}
          y={oftl.y + h * p}
          width={w + pad * 2 + 4}
          height="6"
          fill="#5d4a26"
          stroke="#3d2c14"
          strokeWidth="0.4"
        />
      ))}

      {/* Dimensions */}
      <DimLine x1={ofbl.x - 18} y1={ofbl.y} x2={oftl.x - 18} y2={oftl.y} />
      <DimLabel
        x={ofbl.x - 26}
        y={(ofbl.y + oftl.y) / 2 + 4}
        text={tLabel}
        anchor="end"
      />

      <DimLine x1={ofbl.x} y1={ofbl.y + 22} x2={ofbr.x} y2={ofbr.y + 22} />
      <DimLabel x={(ofbl.x + ofbr.x) / 2} y={ofbl.y + 38} text={sLabel} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Bekisting Balok — beam with U-shape formwork (cross section view)
// ─────────────────────────────────────────────────────────────────────────────

function FormworkBeamDiagram({
  pLabel,
  lLabel,
  tLabel,
}: {
  pLabel: string;
  lLabel: string;
  tLabel: string;
}) {
  const x0 = 60;
  const y0 = 180;
  const w = 240;
  const h = 70;
  const dx = 50;
  const dy = -32;
  const pad = 5;

  // Outer wood (U-shape: bawah + 2 sisi, atas terbuka)
  const ofbl = { x: x0 - pad, y: y0 + pad };
  const ofbr = { x: x0 + w + pad, y: y0 + pad };
  const oftr = { x: x0 + w + pad, y: y0 - h };
  const oftl = { x: x0 - pad, y: y0 - h };

  // Inner concrete top (open)
  const ctl = { x: x0, y: y0 - h + 4 };
  const ctr = { x: x0 + w, y: y0 - h + 4 };
  const bctl = { x: ctl.x + dx, y: ctl.y + dy };
  const bctr = { x: ctr.x + dx, y: ctr.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Top opening — concrete visible */}
      <polygon
        points={`${ctl.x},${ctl.y} ${ctr.x},${ctr.y} ${bctr.x},${bctr.y} ${bctl.x},${bctl.y}`}
        fill="url(#concrete-top)"
        stroke="#5d5d5d"
        strokeWidth="0.6"
      />

      {/* Right end (cross-section showing U-shape) */}
      <polygon
        points={`${ofbr.x},${ofbr.y} ${oftr.x},${oftr.y} ${oftr.x + dx},${oftr.y + dy} ${ofbr.x + dx},${ofbr.y + dy}`}
        fill="url(#wood-tex)"
        stroke="#5d4a26"
        strokeWidth="0.8"
      />
      <polygon
        points={`${ofbr.x},${ofbr.y} ${oftr.x},${oftr.y} ${oftr.x + dx},${oftr.y + dy} ${ofbr.x + dx},${ofbr.y + dy}`}
        fill="url(#wood-shade)"
      />
      {/* Front face wood */}
      <polygon
        points={`${ofbl.x},${ofbl.y} ${ofbr.x},${ofbr.y} ${oftr.x},${oftr.y} ${oftl.x},${oftl.y}`}
        fill="url(#wood-tex)"
        stroke="#5d4a26"
        strokeWidth="1"
      />

      {/* Vertical battens (papan vertikal di sisi) */}
      {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((p) => (
        <line
          key={p}
          x1={ofbl.x + (ofbr.x - ofbl.x) * p}
          y1={ofbl.y}
          x2={ofbl.x + (ofbr.x - ofbl.x) * p}
          y2={oftl.y}
          stroke="#5d4a26"
          strokeWidth="0.5"
          opacity="0.7"
        />
      ))}

      {/* Support stilts (perancah) */}
      {[0.15, 0.85].map((p) => (
        <g key={p}>
          <line
            x1={ofbl.x + (ofbr.x - ofbl.x) * p}
            y1={ofbl.y + 6}
            x2={ofbl.x + (ofbr.x - ofbl.x) * p}
            y2={y0 + 50}
            stroke="#5d4a26"
            strokeWidth="2"
          />
        </g>
      ))}

      {/* Dimensions */}
      <DimLine x1={ofbl.x} y1={ofbl.y + 60} x2={ofbr.x} y2={ofbr.y + 60} />
      <DimLabel x={(ofbl.x + ofbr.x) / 2} y={ofbl.y + 76} text={pLabel} />

      <DimLine x1={ofbr.x + 16} y1={ofbr.y + 6} x2={ofbr.x + dx + 16} y2={ofbr.y + dy + 6} />
      <DimLabel
        x={ofbr.x + dx / 2 + 30}
        y={ofbr.y + dy / 2 + 22}
        text={lLabel}
        anchor="start"
      />

      <DimLine x1={ofbl.x - 18} y1={ofbl.y} x2={oftl.x - 18} y2={oftl.y} />
      <DimLabel
        x={ofbl.x - 26}
        y={(ofbl.y + oftl.y) / 2 + 4}
        text={tLabel}
        anchor="end"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Bekisting Plat — plywood under slab with support stilts
// ─────────────────────────────────────────────────────────────────────────────

function FormworkSlabDiagram({
  pLabel,
  lLabel,
}: {
  pLabel: string;
  lLabel: string;
}) {
  const x0 = 70;
  const y0 = 130;
  const w = 240;
  const dx = 50;
  const dy = -30;

  const fbl = { x: x0, y: y0 };
  const fbr = { x: x0 + w, y: y0 };
  const btl = { x: fbl.x + dx, y: fbl.y + dy };
  const btr = { x: fbr.x + dx, y: fbr.y + dy };

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Plywood underside (top face from below) */}
      <polygon
        points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`}
        fill="url(#wood-tex)"
        stroke="#5d4a26"
        strokeWidth="1"
      />

      {/* Plywood seams (papan di-sambung) */}
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={fbl.x + (fbr.x - fbl.x) * p}
          y1={fbl.y}
          x2={btl.x + (btr.x - btl.x) * p}
          y2={btl.y}
          stroke="#5d4a26"
          strokeWidth="0.8"
        />
      ))}

      {/* Support stilts (perancah dari bawah) */}
      {[0.15, 0.4, 0.65, 0.9].map((p) => (
        <g key={p}>
          <line
            x1={fbl.x + (fbr.x - fbl.x) * p}
            y1={fbl.y + 4}
            x2={fbl.x + (fbr.x - fbl.x) * p}
            y2={fbl.y + 80}
            stroke="#5d4a26"
            strokeWidth="2.5"
          />
          <line
            x1={fbl.x + (fbr.x - fbl.x) * p - 8}
            y1={fbl.y + 80}
            x2={fbl.x + (fbr.x - fbl.x) * p + 8}
            y2={fbl.y + 80}
            stroke="#5d4a26"
            strokeWidth="2"
          />
        </g>
      ))}
      {/* Back row stilts */}
      {[0.15, 0.65].map((p) => (
        <g key={`b${p}`}>
          <line
            x1={btl.x + (btr.x - btl.x) * p}
            y1={btl.y + 4}
            x2={btl.x + (btr.x - btl.x) * p}
            y2={btl.y + 78}
            stroke="#5d4a26"
            strokeWidth="2"
            opacity="0.7"
          />
        </g>
      ))}

      {/* Dimensions */}
      <DimLine x1={fbl.x} y1={fbl.y + 100} x2={fbr.x} y2={fbr.y + 100} />
      <DimLabel x={(fbl.x + fbr.x) / 2} y={fbl.y + 116} text={pLabel} />

      <DimLine x1={fbr.x + 14} y1={fbr.y - 4} x2={btr.x + 14} y2={btr.y - 4} />
      <DimLabel
        x={(fbr.x + btr.x) / 2 + 26}
        y={(fbr.y + btr.y) / 2 + 6}
        text={lLabel}
        anchor="start"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Pembesian — rebar bundle with ties
// ─────────────────────────────────────────────────────────────────────────────

function RebarDiagram({
  diaLabel,
  pLabel,
  nLabel,
}: {
  diaLabel: string;
  pLabel: string;
  nLabel: string;
}) {
  const x0 = 60;
  const yMid = 130;
  const length = 260;

  // Multiple rebars stacked
  const rebars = [
    { y: yMid - 20 },
    { y: yMid - 8 },
    { y: yMid + 4 },
    { y: yMid + 16 },
  ];

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Rebars — long horizontal */}
      {rebars.map((r, i) => (
        <g key={i}>
          <rect
            x={x0}
            y={r.y - 2}
            width={length}
            height="5"
            fill="url(#rebar)"
            rx="1"
          />
          {/* Ribbed pattern (texture) */}
          {Array.from({ length: 26 }, (_, k) => k * 10).map((dx) => (
            <line
              key={dx}
              x1={x0 + dx}
              y1={r.y - 2}
              x2={x0 + dx + 2}
              y2={r.y + 3}
              stroke="#1a1a1a"
              strokeWidth="0.5"
              opacity="0.6"
            />
          ))}
        </g>
      ))}

      {/* Tie wires (kawat ikat) */}
      {[0.15, 0.4, 0.65, 0.9].map((p) => (
        <g key={p}>
          <ellipse
            cx={x0 + length * p}
            cy={yMid - 2}
            rx="2"
            ry="32"
            fill="none"
            stroke="#525252"
            strokeWidth="1.2"
            transform={`rotate(15, ${x0 + length * p}, ${yMid - 2})`}
          />
        </g>
      ))}

      {/* Cross-section at right end (circle showing diameter) */}
      {rebars.map((r, i) => (
        <circle
          key={`cs${i}`}
          cx={x0 + length}
          cy={r.y + 0.5}
          r="3"
          fill="url(#rebar)"
          stroke="#1a1a1a"
          strokeWidth="0.6"
        />
      ))}

      {/* Dimension labels (callouts) */}
      <DimLine x1={x0} y1={yMid + 50} x2={x0 + length} y2={yMid + 50} />
      <DimLabel x={x0 + length / 2} y={yMid + 66} text={pLabel} />

      {/* Diameter callout */}
      <line
        x1={x0 + length + 8}
        y1={yMid + 0.5}
        x2={x0 + length + 30}
        y2={yMid - 30}
        stroke="#525252"
        strokeWidth="0.6"
      />
      <DimLabel
        x={x0 + length + 32}
        y={yMid - 30}
        text={diaLabel}
        anchor="start"
      />

      {/* Number of bars callout */}
      <line
        x1={x0 - 6}
        y1={yMid - 2}
        x2={x0 - 28}
        y2={yMid - 30}
        stroke="#525252"
        strokeWidth="0.6"
      />
      <DimLabel x={x0 - 28} y={yMid - 30} text={nLabel} anchor="end" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Plafon — ceiling viewed from below
// ─────────────────────────────────────────────────────────────────────────────

function CeilingDiagram({
  pLabel,
  lLabel,
}: {
  pLabel: string;
  lLabel: string;
}) {
  const x0 = 70;
  const y0 = 70;
  const w = 240;
  const h = 140;

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Ceiling surface */}
      <rect
        x={x0}
        y={y0}
        width={w}
        height={h}
        fill="url(#ceiling-tex)"
        stroke="#7a6c4d"
        strokeWidth="1"
      />

      {/* Frame structure (rangka plafon) — visible grid */}
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={`v${p}`}
          x1={x0 + w * p}
          y1={y0}
          x2={x0 + w * p}
          y2={y0 + h}
          stroke="#a3997a"
          strokeWidth="0.8"
          strokeDasharray="6 3"
          opacity="0.6"
        />
      ))}
      {[0.33, 0.66].map((p) => (
        <line
          key={`h${p}`}
          x1={x0}
          y1={y0 + h * p}
          x2={x0 + w}
          y2={y0 + h * p}
          stroke="#a3997a"
          strokeWidth="0.8"
          strokeDasharray="6 3"
          opacity="0.6"
        />
      ))}

      {/* Lampu (downlight) accent */}
      {[
        [0.25, 0.33],
        [0.5, 0.33],
        [0.75, 0.33],
        [0.25, 0.66],
        [0.75, 0.66],
      ].map(([px, py], i) => (
        <g key={i}>
          <circle
            cx={x0 + w * px}
            cy={y0 + h * py}
            r="6"
            fill="#fbbf24"
            stroke="#92400e"
            strokeWidth="0.6"
          />
          <circle
            cx={x0 + w * px}
            cy={y0 + h * py}
            r="3"
            fill="#fef3c7"
          />
        </g>
      ))}

      {/* Dimensions */}
      <DimLine x1={x0} y1={y0 + h + 20} x2={x0 + w} y2={y0 + h + 20} />
      <DimLabel x={x0 + w / 2} y={y0 + h + 36} text={pLabel} />

      <DimLine x1={x0 - 18} y1={y0} x2={x0 - 18} y2={y0 + h} />
      <DimLabel x={x0 - 26} y={y0 + h / 2 + 4} text={lLabel} anchor="end" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Bowplank — top-down site with corner posts + string
// ─────────────────────────────────────────────────────────────────────────────

function BowplankDiagram({
  pLabel,
  lLabel,
}: {
  pLabel: string;
  lLabel: string;
}) {
  const x0 = 90;
  const y0 = 80;
  const w = 200;
  const h = 140;
  const margin = 20; // bowplank lebih luar dari struktur

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Site / ground */}
      <rect
        x={x0 - margin - 10}
        y={y0 - margin - 10}
        width={w + margin * 2 + 20}
        height={h + margin * 2 + 20}
        fill="url(#earth-tex)"
        opacity="0.5"
      />

      {/* Bowplank rectangle (string outline) */}
      <rect
        x={x0 - margin}
        y={y0 - margin}
        width={w + margin * 2}
        height={h + margin * 2}
        fill="none"
        stroke="#dc2626"
        strokeWidth="1.5"
        strokeDasharray="6 3"
      />

      {/* Building footprint (struktur dalam) */}
      <rect
        x={x0}
        y={y0}
        width={w}
        height={h}
        fill="rgba(248, 113, 113, 0.15)"
        stroke="#7a2410"
        strokeWidth="0.8"
        strokeDasharray="2 2"
      />

      {/* Corner posts (patok kayu) */}
      {[
        [x0 - margin, y0 - margin],
        [x0 + w + margin, y0 - margin],
        [x0 + w + margin, y0 + h + margin],
        [x0 - margin, y0 + h + margin],
      ].map(([px, py], i) => (
        <g key={i}>
          <rect
            x={px - 4}
            y={py - 4}
            width="8"
            height="8"
            fill="url(#wood-tex)"
            stroke="#5d4a26"
            strokeWidth="0.8"
          />
          {/* Cross piece */}
          <rect
            x={px - 16}
            y={py - 1}
            width="32"
            height="3"
            fill="#a87a3d"
            stroke="#5d4a26"
            strokeWidth="0.4"
          />
          <rect
            x={px - 1}
            y={py - 16}
            width="3"
            height="32"
            fill="#a87a3d"
            stroke="#5d4a26"
            strokeWidth="0.4"
          />
        </g>
      ))}

      {/* Dimensions */}
      <DimLine
        x1={x0 - margin}
        y1={y0 - margin - 20}
        x2={x0 + w + margin}
        y2={y0 - margin - 20}
      />
      <DimLabel
        x={(x0 - margin + x0 + w + margin) / 2}
        y={y0 - margin - 24}
        text={pLabel}
      />

      <DimLine
        x1={x0 - margin - 20}
        y1={y0 - margin}
        x2={x0 - margin - 20}
        y2={y0 + h + margin}
      />
      <DimLabel
        x={x0 - margin - 28}
        y={(y0 - margin + y0 + h + margin) / 2 + 4}
        text={lLabel}
        anchor="end"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Bouwplank Rich — top-down lahan + struktur dashed + patok + profil
// ─────────────────────────────────────────────────────────────────────────────

function BouwplankDiagramRich({
  pLabel,
  lLabel,
  offsetLabel,
  jarakLabel,
  tinggiPatokVal,
}: {
  pLabel: string;
  lLabel: string;
  offsetLabel: string;
  jarakLabel: string;
  tinggiPatokVal: number;
}) {
  const x0 = 90;
  const y0 = 60;
  const w = 200;
  const h = 130;
  const margin = 22; // bouwplank offset (visual)

  // Inner = bangunan (dashed)
  const innerLeft = x0;
  const innerTop = y0;
  const innerRight = x0 + w;
  const innerBot = y0 + h;

  // Outer = bouwplank perimeter
  const outerLeft = innerLeft - margin;
  const outerTop = innerTop - margin;
  const outerRight = innerRight + margin;
  const outerBot = innerBot + margin;

  // Patok positions along outer perimeter (visualized at intervals)
  const patokSpacing = 28; // visual spacing
  const patok: { x: number; y: number }[] = [];
  // Top edge
  for (let x = outerLeft; x <= outerRight; x += patokSpacing) {
    patok.push({ x, y: outerTop });
  }
  // Right edge
  for (let y = outerTop + patokSpacing; y < outerBot; y += patokSpacing) {
    patok.push({ x: outerRight, y });
  }
  // Bottom edge
  for (let x = outerRight; x >= outerLeft; x -= patokSpacing) {
    patok.push({ x, y: outerBot });
  }
  // Left edge
  for (let y = outerBot - patokSpacing; y > outerTop; y -= patokSpacing) {
    patok.push({ x: outerLeft, y });
  }

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Lahan / ground */}
      <rect
        x={outerLeft - 15}
        y={outerTop - 15}
        width={outerRight - outerLeft + 30}
        height={outerBot - outerTop + 30}
        fill="url(#earth-tex)"
        opacity="0.4"
      />

      {/* Bouwplank perimeter (papan profil) — kayu coklat */}
      <rect
        x={outerLeft}
        y={outerTop}
        width={outerRight - outerLeft}
        height={outerBot - outerTop}
        fill="none"
        stroke="#8b6f3d"
        strokeWidth="3"
      />
      {/* Inner shadow biar keliatan papan */}
      <rect
        x={outerLeft - 2}
        y={outerTop - 2}
        width={outerRight - outerLeft + 4}
        height={outerBot - outerTop + 4}
        fill="none"
        stroke="#5d4a26"
        strokeWidth="1"
      />

      {/* Bangunan (struktur) — dashed merah pucat */}
      <rect
        x={innerLeft}
        y={innerTop}
        width={innerRight - innerLeft}
        height={innerBot - innerTop}
        fill="rgba(248, 113, 113, 0.1)"
        stroke="#dc2626"
        strokeWidth="0.8"
        strokeDasharray="4 3"
      />
      <text
        x={(innerLeft + innerRight) / 2}
        y={(innerTop + innerBot) / 2 + 3}
        textAnchor="middle"
        className="font-mono"
        fill="#7a2410"
        style={{ fontSize: "9px", fontWeight: 600 }}
      >
        BANGUNAN
      </text>

      {/* Patok kayu di tiap intersect */}
      {patok.map((p, i) => (
        <g key={i}>
          {/* Crossing kayu (cross-piece) */}
          <line
            x1={p.x - 5}
            y1={p.y - 5}
            x2={p.x + 5}
            y2={p.y + 5}
            stroke="#5d4a26"
            strokeWidth="1.5"
          />
          <line
            x1={p.x - 5}
            y1={p.y + 5}
            x2={p.x + 5}
            y2={p.y - 5}
            stroke="#5d4a26"
            strokeWidth="1.5"
          />
          {/* Center dot (patok) */}
          <rect
            x={p.x - 2.5}
            y={p.y - 2.5}
            width="5"
            height="5"
            fill="#a87a3d"
            stroke="#3d2c14"
            strokeWidth="0.6"
          />
        </g>
      ))}

      {/* Offset indicator (between bangunan and bouwplank) */}
      <line
        x1={innerRight}
        y1={(innerTop + innerBot) / 2}
        x2={outerRight}
        y2={(innerTop + innerBot) / 2}
        stroke="#dc2626"
        strokeWidth="0.6"
        markerStart="url(#dim-arrow-start)"
        markerEnd="url(#dim-arrow-end)"
      />
      <text
        x={(innerRight + outerRight) / 2}
        y={(innerTop + innerBot) / 2 - 3}
        textAnchor="middle"
        className="font-mono"
        fill="#7a2410"
        style={{ fontSize: "8px", fontWeight: 600 }}
      >
        {offsetLabel}
      </text>

      {/* Bangunan dimensions (P, L) */}
      <DimLine
        x1={innerLeft}
        y1={innerBot + 6}
        x2={innerRight}
        y2={innerBot + 6}
      />
      <DimLabel
        x={(innerLeft + innerRight) / 2}
        y={innerBot + 22}
        text={pLabel}
      />

      <DimLine
        x1={innerLeft - 6}
        y1={innerTop}
        x2={innerLeft - 6}
        y2={innerBot}
      />
      <DimLabel
        x={innerLeft - 14}
        y={(innerTop + innerBot) / 2 + 4}
        text={lLabel}
        anchor="end"
      />

      {/* Jarak antar patok callout (visual hint) */}
      <text
        x={(outerLeft + outerRight) / 2}
        y={outerTop - 22}
        textAnchor="middle"
        className="font-mono"
        fill="#5d4a26"
        style={{ fontSize: "9px", fontWeight: 600 }}
      >
        Patok {jarakLabel}
      </text>

      {/* Tinggi patok mini-info bottom-left */}
      <g transform={`translate(20, 220)`}>
        <rect
          x="0"
          y="0"
          width="80"
          height="48"
          fill="#fef3c7"
          stroke="#92400e"
          strokeWidth="0.6"
          rx="3"
        />
        <text x="6" y="14" fill="#92400e" style={{ fontSize: "9px", fontWeight: 600 }}>
          Tinggi Patok
        </text>
        {/* Mini patok illustration */}
        <line x1="40" y1="42" x2="40" y2={42 - tinggiPatokVal * 30} stroke="#a87a3d" strokeWidth="3" />
        <line x1="32" y1="36" x2="48" y2="36" stroke="#5d4a26" strokeWidth="1.2" />
        <line x1="32" y1="42" x2="48" y2="42" stroke="#5e4724" strokeWidth="2" strokeDasharray="2 1" />
        <text x="6" y="44" fill="#92400e" font-size="8">
          tertanam: 30 cm
        </text>
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Atap Kuda-kuda Kayu — triangular truss frame
// ─────────────────────────────────────────────────────────────────────────────

function TrussDiagram({
  bentangLabel,
  tinggiLabel,
}: {
  bentangLabel: string;
  tinggiLabel: string;
}) {
  const x0 = 60;
  const yBase = 220;
  const w = 260; // bentang
  const h = 110; // tinggi puncak

  const left = { x: x0, y: yBase };
  const right = { x: x0 + w, y: yBase };
  const apex = { x: x0 + w / 2, y: yBase - h };
  const mid = { x: (left.x + right.x) / 2, y: yBase };

  // Internal members
  const ql = { x: left.x + w * 0.25, y: yBase - h * 0.5 };
  const qr = { x: right.x - w * 0.25, y: yBase - h * 0.5 };

  const woodStroke = "#5d4a26";
  const woodColor = "#a87a3d";

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Bottom chord (balok tarik) */}
      <line
        x1={left.x}
        y1={left.y}
        x2={right.x}
        y2={right.y}
        stroke={woodColor}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <line
        x1={left.x}
        y1={left.y}
        x2={right.x}
        y2={right.y}
        stroke={woodStroke}
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0"
      />

      {/* Left rafter */}
      <line
        x1={left.x}
        y1={left.y}
        x2={apex.x}
        y2={apex.y}
        stroke={woodColor}
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Right rafter */}
      <line
        x1={right.x}
        y1={right.y}
        x2={apex.x}
        y2={apex.y}
        stroke={woodColor}
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* King post (vertical) */}
      <line
        x1={apex.x}
        y1={apex.y}
        x2={mid.x}
        y2={mid.y}
        stroke={woodColor}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Diagonal struts */}
      <line
        x1={ql.x}
        y1={ql.y}
        x2={mid.x}
        y2={mid.y}
        stroke={woodColor}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <line
        x1={qr.x}
        y1={qr.y}
        x2={mid.x}
        y2={mid.y}
        stroke={woodColor}
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Joint bolts */}
      {[left, right, apex, mid, ql, qr].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#1a1a1a" />
      ))}

      {/* Dimensions */}
      <DimLine x1={left.x} y1={left.y + 22} x2={right.x} y2={right.y + 22} />
      <DimLabel
        x={(left.x + right.x) / 2}
        y={left.y + 38}
        text={bentangLabel}
      />

      <DimLine x1={left.x - 18} y1={left.y} x2={apex.x - w / 2 - 18} y2={apex.y} />
      <DimLabel
        x={left.x - 26}
        y={(left.y + apex.y) / 2 + 4}
        text={tinggiLabel}
        anchor="end"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram: Pipa (PVC pipe) — long cylinder along length
// ─────────────────────────────────────────────────────────────────────────────

function PipeDiagram({
  pLabel,
  diaLabel,
}: {
  pLabel: string;
  diaLabel: string;
}) {
  const x0 = 60;
  const yMid = 140;
  const length = 260;
  const radius = 18;

  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />

      {/* Pipe body */}
      <rect
        x={x0}
        y={yMid - radius}
        width={length}
        height={radius * 2}
        fill="url(#pipe-pvc)"
        stroke="#525252"
        strokeWidth="0.8"
      />
      {/* Highlight band */}
      <line
        x1={x0}
        y1={yMid - radius * 0.5}
        x2={x0 + length}
        y2={yMid - radius * 0.5}
        stroke="#fafafa"
        strokeWidth="2"
        opacity="0.6"
      />
      {/* Right end (cap) — circle */}
      <ellipse
        cx={x0 + length}
        cy={yMid}
        rx="6"
        ry={radius}
        fill="url(#pipe-pvc)"
        stroke="#525252"
        strokeWidth="1"
      />
      <ellipse
        cx={x0 + length}
        cy={yMid}
        rx="3.5"
        ry={radius * 0.7}
        fill="#3d3d3d"
        opacity="0.5"
      />
      {/* Left end ring */}
      <ellipse
        cx={x0}
        cy={yMid}
        rx="4"
        ry={radius}
        fill="#5d5d5d"
        stroke="#3d3d3d"
        strokeWidth="0.8"
      />

      {/* Couplings (sambungan) along length */}
      {[0.33, 0.66].map((p) => (
        <g key={p}>
          <rect
            x={x0 + length * p - 5}
            y={yMid - radius - 3}
            width="10"
            height={radius * 2 + 6}
            fill="#7a7a7a"
            stroke="#3d3d3d"
            strokeWidth="0.6"
          />
        </g>
      ))}

      {/* Dimensions */}
      <DimLine x1={x0} y1={yMid + radius + 20} x2={x0 + length} y2={yMid + radius + 20} />
      <DimLabel x={x0 + length / 2} y={yMid + radius + 36} text={pLabel} />

      {/* Diameter callout */}
      <line
        x1={x0 + length + 12}
        y1={yMid - radius}
        x2={x0 + length + 32}
        y2={yMid - radius - 30}
        stroke="#525252"
        strokeWidth="0.6"
      />
      <DimLabel
        x={x0 + length + 32}
        y={yMid - radius - 30}
        text={diaLabel}
        anchor="start"
      />
    </svg>
  );
}

function LumsumDiagram({ n }: { n: number }) {
  // Box "paket" ikon — simple, no perspective. Label "LS" + jumlah paket.
  const count = Math.max(1, Math.min(6, Math.round(n)));
  const boxW = 50;
  const boxH = 56;
  const gap = 8;
  const totalW = count * boxW + (count - 1) * gap;
  const startX = (380 - totalW) / 2;
  const y = 110;
  return (
    <svg
      viewBox="0 0 380 280"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SharedDefs />
      {Array.from({ length: count }, (_, i) => {
        const x = startX + i * (boxW + gap);
        return (
          <g key={i}>
            {/* Box body */}
            <rect
              x={x}
              y={y}
              width={boxW}
              height={boxH}
              fill="#fef3c7"
              stroke="#d97706"
              strokeWidth="1.5"
              rx="2"
            />
            {/* Tape lines on top */}
            <line
              x1={x}
              y1={y + 16}
              x2={x + boxW}
              y2={y + 16}
              stroke="#d97706"
              strokeWidth="1"
              opacity="0.5"
            />
            <line
              x1={x + boxW / 2}
              y1={y}
              x2={x + boxW / 2}
              y2={y + 16}
              stroke="#d97706"
              strokeWidth="1"
              opacity="0.5"
            />
            {/* LS label */}
            <text
              x={x + boxW / 2}
              y={y + boxH / 2 + 8}
              textAnchor="middle"
              className="fill-current font-mono"
              fontSize="16"
              fontWeight="700"
              fill="#92400e"
            >
              LS
            </text>
          </g>
        );
      })}
      {/* Caption */}
      <text
        x="190"
        y={y + boxH + 28}
        textAnchor="middle"
        className="fill-current font-mono"
        fontSize="13"
        fill="#525252"
      >
        {fmt(n, 2)} paket lumsum
      </text>
      {n > 6 && (
        <text
          x="190"
          y={y + boxH + 46}
          textAnchor="middle"
          className="fill-current"
          fontSize="10"
          fill="#a3a3a3"
        >
          (max 6 yang ditampilkan)
        </text>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculator definitions
// ─────────────────────────────────────────────────────────────────────────────

export const CALCULATORS: CalcDef[] = [
  {
    type: "galian_tapak",
    label: "Galian Pondasi Tapak/Menerus",
    description:
      "Galian tanah untuk pondasi tapak (titik tunggal) atau menerus. Output utama: volume galian (m³). Plus info: volume urugan pasir lantai kerja, volume urugan kembali bekas galian.",
    outputUnit: "m³",
    outputLabel: "Volume Galian Tanah",
    inputs: [
      // Dimensi galian
      {
        key: "P",
        label: "Panjang Galian",
        unit: "m",
        default: 1,
        min: 0,
        hint: "Panjang per titik (atau total kalau menerus)",
        group: "Dimensi Galian",
      },
      {
        key: "L",
        label: "Lebar Galian",
        unit: "m",
        default: 1,
        min: 0,
        group: "Dimensi Galian",
      },
      {
        key: "T",
        label: "Kedalaman",
        unit: "m",
        default: 1,
        min: 0,
        hint: "Kedalaman dari permukaan tanah",
        group: "Dimensi Galian",
      },
      {
        key: "n",
        label: "Jumlah Titik",
        unit: "titik",
        default: 1,
        min: 1,
        hint: "1 untuk pondasi menerus, atau jumlah titik tapak",
        group: "Dimensi Galian",
      },
      // Spesifikasi tanah & lantai kerja
      {
        key: "kemiringan",
        label: "Kemiringan Galian",
        unit: "%",
        default: 0,
        min: 0,
        hint: "0% = tegak. Tanah lunak biasanya 25–30% miring.",
        group: "Spesifikasi",
      },
      {
        key: "tebalPasir",
        label: "Tebal Urugan Pasir Lantai Kerja",
        unit: "m",
        default: 0.05,
        min: 0,
        hint: "Default 5 cm = 0.05 m. Set 0 kalau gak pakai.",
        group: "Spesifikasi",
      },
      {
        key: "tebalLantaiKerja",
        label: "Tebal Lantai Kerja Beton",
        unit: "m",
        default: 0.05,
        min: 0,
        hint: "Beton tumbuk 1:3:5 untuk dasar. 0 kalau gak pakai.",
        group: "Spesifikasi",
      },
      {
        key: "rasioUrugan",
        label: "Rasio Urugan Kembali",
        unit: "%",
        default: 30,
        min: 0,
        hint: "% galian yang diurug kembali (30% biasanya, sisanya pondasi)",
        group: "Spesifikasi",
      },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const T = num(i.T);
      const n = num(i.n, 1);
      const kemiringan = num(i.kemiringan, 0);
      const tebalPasir = num(i.tebalPasir, 0.05);
      const tebalLantaiKerja = num(i.tebalLantaiKerja, 0.05);
      const rasioUrugan = num(i.rasioUrugan, 30);

      // Volume galian per titik
      const baseVol = P * L * T;
      // Adjust kalau ada kemiringan: V = (A_atas + A_bawah)/2 × T
      // A_atas = (P + 2×T×k) × (L + 2×T×k) di mana k = kemiringan/100
      const k = kemiringan / 100;
      const atasP = P + 2 * T * k;
      const atasL = L + 2 * T * k;
      const aAtas = atasP * atasL;
      const aBawah = P * L;
      const volPerTitik =
        kemiringan > 0 ? ((aAtas + aBawah) / 2) * T : baseVol;
      const v = volPerTitik * n;

      // Volume urugan pasir = P × L × tebalPasir × n
      const volPasir = P * L * tebalPasir * n;
      // Volume lantai kerja beton = P × L × tebalLantaiKerja × n
      const volLantaiKerja = P * L * tebalLantaiKerja * n;
      // Volume urugan kembali = v × rasio
      const volUrugan = v * (rasioUrugan / 100);

      const formula =
        kemiringan > 0
          ? `((${fmt(atasP, 2)}×${fmt(atasL, 2)} + ${fmt(P, 2)}×${fmt(L, 2)})/2) × ${fmt(T, 2)} × ${fmt(n, 0)} = ${fmt(v, 3)} m³`
          : `${fmt(P, 2)} × ${fmt(L, 2)} × ${fmt(T, 2)} × ${fmt(n, 0)} = ${fmt(v, 3)} m³`;

      return {
        value: v,
        formula,
        info: [
          {
            label: "Vol. Galian",
            value: `${fmt(v, 3)} m³`,
            highlight: true,
          },
          {
            label: "Vol. per Titik",
            value: `${fmt(volPerTitik, 3)} m³`,
          },
          {
            label: "Urugan Pasir",
            value: `${fmt(volPasir, 3)} m³`,
          },
          {
            label: "Lantai Kerja Beton",
            value: `${fmt(volLantaiKerja, 3)} m³`,
          },
          {
            label: "Urugan Kembali",
            value: `${fmt(volUrugan, 3)} m³`,
          },
          ...(kemiringan > 0
            ? [
                {
                  label: "Penampang Atas",
                  value: `${fmt(atasP, 2)} × ${fmt(atasL, 2)} m`,
                },
              ]
            : []),
        ],
      };
    },
    Diagram: ({ values }) => (
      <FootingDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  {
    type: "footplate",
    label: "Footplate / Pondasi Tapak Beton",
    description:
      "Pondasi tapak (footplate) beton bertulang per titik. Beda dari Galian Pondasi Tapak — ini menghitung BETON + TULANGAN-nya, bukan galian tanahnya. Output utama: volume beton (m³). Info: tulangan grid (arah X & Y), stek ke kolom, bekisting samping.",
    outputUnit: "m³",
    outputLabel: "Volume Beton",
    inputs: [
      // Dimensi
      {
        key: "P",
        label: "Panjang Tapak (P)",
        unit: "m",
        default: 1,
        min: 0,
        hint: "Sisi arah X per titik footplate",
        group: "Dimensi Footplate",
      },
      {
        key: "L",
        label: "Lebar Tapak (L)",
        unit: "m",
        default: 1,
        min: 0,
        hint: "Sisi arah Y per titik footplate",
        group: "Dimensi Footplate",
      },
      {
        key: "T",
        label: "Tebal/Tinggi (T)",
        unit: "m",
        default: 0.25,
        min: 0,
        hint: "Tebal pelat footplate. Standar 20–30 cm.",
        group: "Dimensi Footplate",
      },
      {
        key: "n",
        label: "Jumlah Titik",
        unit: "titik",
        default: 1,
        min: 1,
        hint: "Jumlah titik footplate identik",
        group: "Dimensi Footplate",
      },
      {
        key: "k",
        label: "Selimut Beton (k)",
        unit: "m",
        default: 0.04,
        min: 0,
        hint: "Tebal selimut beton ke besi. Default 4 cm untuk pondasi.",
        group: "Dimensi Footplate",
      },
      // Spesifikasi beton
      {
        key: "mutuBeton",
        label: "Mutu Beton",
        unit: "K",
        default: 225,
        group: "Spesifikasi Beton",
        options: [
          { value: 175, label: "K-175 (fc 14.5)" },
          { value: 225, label: "K-225 (fc 19.3)" },
          { value: 275, label: "K-275 (fc 22.5)" },
          { value: 300, label: "K-300 (fc 24.9)" },
        ],
      },
      // Tulangan arah X
      {
        key: "Dx",
        label: "Ø Tulangan Arah X",
        unit: "mm",
        default: 12,
        group: "Tulangan Arah X",
        options: [
          { value: 10, label: "Ø10 mm (0.62 kg/m)" },
          { value: 12, label: "Ø12 mm (0.89 kg/m)" },
          { value: 13, label: "Ø13 mm (1.04 kg/m)" },
          { value: 16, label: "Ø16 mm (1.58 kg/m)" },
        ],
      },
      {
        key: "Rx",
        label: "Jarak Tulangan X",
        unit: "m",
        default: 0.15,
        min: 0.05,
        hint: "Jarak antar besi arah X. Standar 10–20 cm.",
        group: "Tulangan Arah X",
      },
      // Tulangan arah Y
      {
        key: "Dy",
        label: "Ø Tulangan Arah Y",
        unit: "mm",
        default: 12,
        group: "Tulangan Arah Y",
        options: [
          { value: 10, label: "Ø10 mm (0.62 kg/m)" },
          { value: 12, label: "Ø12 mm (0.89 kg/m)" },
          { value: 13, label: "Ø13 mm (1.04 kg/m)" },
          { value: 16, label: "Ø16 mm (1.58 kg/m)" },
        ],
      },
      {
        key: "Ry",
        label: "Jarak Tulangan Y",
        unit: "m",
        default: 0.15,
        min: 0.05,
        hint: "Jarak antar besi arah Y. Standar 10–20 cm.",
        group: "Tulangan Arah Y",
      },
      // Stek/Anker ke kolom
      {
        key: "Ds",
        label: "Ø Stek ke Kolom",
        unit: "mm",
        default: 12,
        group: "Stek Kolom",
        options: [
          { value: 10, label: "Ø10 mm (0.62 kg/m)" },
          { value: 12, label: "Ø12 mm (0.89 kg/m)" },
          { value: 13, label: "Ø13 mm (1.04 kg/m)" },
          { value: 16, label: "Ø16 mm (1.58 kg/m)" },
          { value: 19, label: "Ø19 mm (2.22 kg/m)" },
        ],
      },
      {
        key: "ns",
        label: "Jumlah Stek per Titik",
        unit: "btg",
        default: 4,
        min: 4,
        hint: "Standar 4 batang per titik (ikut jumlah besi utama kolom).",
        group: "Stek Kolom",
      },
      {
        key: "lstek",
        label: "Panjang Stek (tertanam + di atas)",
        unit: "m",
        default: 0.75,
        min: 0.3,
        hint: "Total panjang stek dari dasar footplate ke atas pile. Default 40D + tebal footplate.",
        group: "Stek Kolom",
      },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const T = num(i.T);
      const n = num(i.n, 1);
      const k = num(i.k, 0.04);
      const Dx = num(i.Dx, 12);
      const Rx = num(i.Rx, 0.15);
      const Dy = num(i.Dy, 12);
      const Ry = num(i.Ry, 0.15);
      const Ds = num(i.Ds, 12);
      const ns = num(i.ns, 4);
      const lstek = num(i.lstek, 0.75);

      const wPerM = (d: number) => REBAR_WEIGHT[d] ?? 0.006165 * d * d;

      // Volume beton total
      const vPerTitik = P * L * T;
      const v = vPerTitik * n;

      // Bekisting: 4 sisi vertikal per titik (atas terbuka, dasar lantai kerja)
      const luasBekisting = 2 * (P + L) * T * n;

      // Tulangan grid arah X (membentang sepanjang P, didistribusi sepanjang L)
      const usableX = Math.max(L - 2 * k, 0);
      const jmlX = usableX > 0 && Rx > 0 ? Math.floor(usableX / Rx) + 1 : 0;
      const panjangPerBesiX = Math.max(P - 2 * k, 0) + 0.2; // +10cm bend per ujung
      const lTotalX = jmlX * panjangPerBesiX * n;
      const wX = lTotalX * wPerM(Dx);

      // Tulangan grid arah Y
      const usableY = Math.max(P - 2 * k, 0);
      const jmlY = usableY > 0 && Ry > 0 ? Math.floor(usableY / Ry) + 1 : 0;
      const panjangPerBesiY = Math.max(L - 2 * k, 0) + 0.2;
      const lTotalY = jmlY * panjangPerBesiY * n;
      const wY = lTotalY * wPerM(Dy);

      // Stek ke kolom
      const lTotalStek = ns * lstek * n;
      const wStek = lTotalStek * wPerM(Ds);

      // Kawat ikat: 1% berat besi
      const wBesi = wX + wY + wStek;
      const wKawat = wBesi * 0.01;
      const totalBesi = wBesi + wKawat;

      const formula = `${fmt(P, 2)} × ${fmt(L, 2)} × ${fmt(T, 2)} × ${fmt(n, 0)} titik = ${fmt(v, 3)} m³`;

      return {
        value: v,
        formula,
        info: [
          {
            label: "Volume Beton",
            value: `${fmt(v, 3)} m³`,
            highlight: true,
          },
          {
            label: `Tulangan X (Ø${Dx})`,
            value: `${jmlX} btg × ${fmt(panjangPerBesiX, 2)} m × ${fmt(n, 0)} = ${fmt(lTotalX, 2)} m → ${fmt(wX, 2)} kg`,
          },
          {
            label: `Tulangan Y (Ø${Dy})`,
            value: `${jmlY} btg × ${fmt(panjangPerBesiY, 2)} m × ${fmt(n, 0)} = ${fmt(lTotalY, 2)} m → ${fmt(wY, 2)} kg`,
          },
          {
            label: `Stek Kolom (Ø${Ds})`,
            value: `${ns} btg × ${fmt(lstek, 2)} m × ${fmt(n, 0)} = ${fmt(lTotalStek, 2)} m → ${fmt(wStek, 2)} kg`,
          },
          {
            label: "Kawat Ikat (1%)",
            value: `${fmt(wKawat, 2)} kg`,
          },
          {
            label: "TOTAL Besi + Kawat",
            value: `${fmt(totalBesi, 2)} kg`,
            highlight: true,
          },
          {
            label: "Bekisting Samping",
            value: `${fmt(luasBekisting, 2)} m²`,
            highlight: true,
          },
        ],
      };
    },
    Diagram: ({ values }) => (
      <FootingDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  {
    type: "sloof_balok",
    label: "Sloof / Balok Beton",
    description:
      "Sloof/balok beton bertulang RAB Pro level: pisah Tulangan Atas (D1) + Bawah (D2) + Sengkang (D3) + Kawat Ikat. Output volume beton (m³), info breakdown panjang & berat besi.",
    outputUnit: "m³",
    outputLabel: "Volume Beton",
    inputs: [
      // Dimensi
      {
        key: "P",
        label: "Panjang Total",
        unit: "m",
        default: 1,
        min: 0,
        hint: "Total panjang sloof/balok",
        group: "Dimensi Sloof/Balok",
      },
      {
        key: "L",
        label: "Lebar Penampang (b)",
        unit: "m",
        default: 0.15,
        min: 0,
        group: "Dimensi Sloof/Balok",
      },
      {
        key: "T",
        label: "Tinggi Penampang (h)",
        unit: "m",
        default: 0.2,
        min: 0,
        group: "Dimensi Sloof/Balok",
      },
      {
        key: "k",
        label: "Selimut Beton (k)",
        unit: "m",
        default: 0.02,
        min: 0,
        hint: "Tebal kulit beton ke muka tulangan. Default 2 cm.",
        group: "Dimensi Sloof/Balok",
      },
      // Spesifikasi beton
      {
        key: "mutuBeton",
        label: "Mutu Beton",
        unit: "K",
        default: 225,
        group: "Spesifikasi Beton",
        options: [
          { value: 175, label: "K-175 (fc 14.5)" },
          { value: 225, label: "K-225 (fc 19.3)" },
          { value: 275, label: "K-275 (fc 22.5)" },
          { value: 300, label: "K-300 (fc 24.9)" },
        ],
      },
      // Tulangan Atas (D1)
      {
        key: "D1",
        label: "Ø Tulangan Atas (D1)",
        unit: "mm",
        default: 12,
        group: "Tulangan Atas",
        options: [
          { value: 10, label: "Ø10 mm (0.62 kg/m)" },
          { value: 12, label: "Ø12 mm (0.89 kg/m)" },
          { value: 13, label: "Ø13 mm (1.04 kg/m)" },
          { value: 16, label: "Ø16 mm (1.58 kg/m)" },
          { value: 19, label: "Ø19 mm (2.22 kg/m)" },
          { value: 22, label: "Ø22 mm (2.98 kg/m)" },
        ],
      },
      {
        key: "n1",
        label: "Jumlah Tulangan Atas",
        unit: "btg",
        default: 2,
        min: 2,
        hint: "Standar 2 batang di sudut atas",
        group: "Tulangan Atas",
      },
      // Tulangan Bawah (D2)
      {
        key: "D2",
        label: "Ø Tulangan Bawah (D2)",
        unit: "mm",
        default: 12,
        group: "Tulangan Bawah",
        options: [
          { value: 10, label: "Ø10 mm (0.62 kg/m)" },
          { value: 12, label: "Ø12 mm (0.89 kg/m)" },
          { value: 13, label: "Ø13 mm (1.04 kg/m)" },
          { value: 16, label: "Ø16 mm (1.58 kg/m)" },
          { value: 19, label: "Ø19 mm (2.22 kg/m)" },
          { value: 22, label: "Ø22 mm (2.98 kg/m)" },
        ],
      },
      {
        key: "n2",
        label: "Jumlah Tulangan Bawah",
        unit: "btg",
        default: 2,
        min: 2,
        hint: "Standar 2 batang di sudut bawah",
        group: "Tulangan Bawah",
      },
      // Sengkang (D3)
      {
        key: "D3",
        label: "Ø Sengkang (D3)",
        unit: "mm",
        default: 8,
        group: "Sengkang (Begel)",
        options: [
          { value: 6, label: "Ø6 mm (0.22 kg/m)" },
          { value: 8, label: "Ø8 mm (0.39 kg/m)" },
          { value: 10, label: "Ø10 mm (0.62 kg/m)" },
        ],
      },
      {
        key: "R",
        label: "Jarak Antar Sengkang (R)",
        unit: "m",
        default: 0.15,
        min: 0.05,
        hint: "Standar 10–20 cm. Daerah tumpuan lebih rapat.",
        group: "Sengkang (Begel)",
      },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const T = num(i.T);
      const k = num(i.k, 0.02);
      const D1 = num(i.D1, 12);
      const n1 = num(i.n1, 2);
      const D2 = num(i.D2, 12);
      const n2 = num(i.n2, 2);
      const D3 = num(i.D3, 8);
      const R = num(i.R, 0.15);

      // Volume beton
      const v = P * L * T;

      // Berat per meter (fallback ke formula 0.006165 × d²)
      const wPerM = (d: number) =>
        REBAR_WEIGHT[d] ?? 0.006165 * d * d;

      // Tulangan Atas: panjang = P × n1
      const lAtas = P * n1;
      const wAtas = lAtas * wPerM(D1);

      // Tulangan Bawah: panjang = P × n2
      const lBawah = P * n2;
      const wBawah = lBawah * wPerM(D2);

      // Sengkang: keliling inside (dikurangi 2 × selimut) + overlap 10cm
      const kelSengkang = 2 * (L - 2 * k + (T - 2 * k)) + 0.1;
      const jmlSengkang = Math.ceil(P / R) + 1;
      const lSengkang = kelSengkang * jmlSengkang;
      const wSengkang = lSengkang * wPerM(D3);

      // Kawat ikat: 1% dari berat besi
      const wBesi = wAtas + wBawah + wSengkang;
      const wKawat = wBesi * 0.01;
      const totalBesi = wBesi + wKawat;

      // Bekisting (3 sisi: 2 sisi vertikal + 1 bawah, atas terbuka)
      const luasBekisting = (2 * T + L) * P;

      const formula = `${fmt(P, 2)} × ${fmt(L, 3)} × ${fmt(T, 3)} = ${fmt(v, 3)} m³`;

      return {
        value: v,
        formula,
        info: [
          {
            label: "Volume Beton",
            value: `${fmt(v, 3)} m³`,
            highlight: true,
          },
          {
            label: `Tulangan Atas (Ø${D1})`,
            value: `${fmt(lAtas, 2)} m → ${fmt(wAtas, 2)} kg`,
          },
          {
            label: `Tulangan Bawah (Ø${D2})`,
            value: `${fmt(lBawah, 2)} m → ${fmt(wBawah, 2)} kg`,
          },
          {
            label: `Sengkang (Ø${D3})`,
            value: `${jmlSengkang} bh × ${fmt(kelSengkang, 2)} m = ${fmt(lSengkang, 2)} m → ${fmt(wSengkang, 2)} kg`,
          },
          {
            label: "Kawat Ikat (1%)",
            value: `${fmt(wKawat, 2)} kg`,
          },
          {
            label: "TOTAL Besi + Kawat",
            value: `${fmt(totalBesi, 2)} kg`,
            highlight: true,
          },
          {
            label: "Bekisting",
            value: `${fmt(luasBekisting, 2)} m²`,
            highlight: true,
          },
        ],
      };
    },
    Diagram: ({ values }) => (
      <BeamDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  {
    type: "kolom",
    label: "Kolom Beton",
    description:
      "Kolom beton bertulang RAB Pro level: pisah Besi Utama + Support + Ring/Begel + Kawat Ikat. Output volume beton (m³), info breakdown panjang & berat besi.",
    outputUnit: "m³",
    outputLabel: "Volume Beton Kolom",
    inputs: [
      // Dimensi
      {
        key: "Lx",
        label: "Lebar 1 (b1)",
        unit: "m",
        default: 0.15,
        min: 0,
        hint: "Sisi X penampang",
        group: "Dimensi Kolom",
      },
      {
        key: "Ly",
        label: "Lebar 2 (b2)",
        unit: "m",
        default: 0.15,
        min: 0,
        hint: "Sisi Y. Sama Lx kalau persegi.",
        group: "Dimensi Kolom",
      },
      {
        key: "T",
        label: "Tinggi Kolom",
        unit: "m",
        default: 4.5,
        min: 0,
        group: "Dimensi Kolom",
      },
      {
        key: "n",
        label: "Jumlah Kolom",
        unit: "buah",
        default: 3,
        min: 1,
        group: "Dimensi Kolom",
      },
      {
        key: "k",
        label: "Selimut Beton (k)",
        unit: "m",
        default: 0.02,
        min: 0,
        hint: "Tebal kulit beton ke muka tulangan. Default 2 cm.",
        group: "Dimensi Kolom",
      },
      // Beton
      {
        key: "mutuBeton",
        label: "Mutu Beton",
        unit: "K",
        default: 225,
        group: "Spesifikasi Beton",
        options: [
          { value: 175, label: "K-175 (fc 14.5)" },
          { value: 225, label: "K-225 (fc 19.3)" },
          { value: 275, label: "K-275 (fc 22.5)" },
          { value: 300, label: "K-300 (fc 24.9)" },
        ],
      },
      // Besi Utama
      {
        key: "D1",
        label: "Ø Besi Utama (D1)",
        unit: "mm",
        default: 10,
        hint: "Tulangan di tiap sudut",
        group: "Besi Utama",
        options: [
          { value: 8, label: "Ø8 mm (0.39 kg/m)" },
          { value: 10, label: "Ø10 mm (0.62 kg/m)" },
          { value: 12, label: "Ø12 mm (0.89 kg/m)" },
          { value: 13, label: "Ø13 mm (1.04 kg/m)" },
          { value: 16, label: "Ø16 mm (1.58 kg/m)" },
          { value: 19, label: "Ø19 mm (2.22 kg/m)" },
        ],
      },
      {
        key: "n1",
        label: "Jumlah Besi Utama",
        unit: "btg",
        default: 4,
        min: 4,
        hint: "Min 4 (1 di tiap sudut)",
        group: "Besi Utama",
      },
      // Besi Support
      {
        key: "D2",
        label: "Ø Besi Support (D2)",
        unit: "mm",
        default: 10,
        hint: "Tulangan tambahan intermediate. Default sama Utama.",
        group: "Besi Support",
        options: [
          { value: 8, label: "Ø8 mm" },
          { value: 10, label: "Ø10 mm" },
          { value: 12, label: "Ø12 mm" },
        ],
      },
      {
        key: "n2",
        label: "Jumlah Besi Support",
        unit: "btg",
        default: 0,
        min: 0,
        hint: "0 = skip. Pakai untuk kolom besar (>30 cm).",
        group: "Besi Support",
      },
      // Besi Ring/Begel (Sengkang)
      {
        key: "D3",
        label: "Ø Ring/Begel (D3)",
        unit: "mm",
        default: 8,
        group: "Sengkang / Ring",
        options: [
          { value: 6, label: "Ø6 mm (0.22 kg/m)" },
          { value: 8, label: "Ø8 mm (0.39 kg/m)" },
          { value: 10, label: "Ø10 mm (0.62 kg/m)" },
        ],
      },
      {
        key: "R",
        label: "Jarak Ring (R)",
        unit: "m",
        default: 0.15,
        min: 0.05,
        hint: "Standar 10–15 cm di tumpuan, 15–20 cm di lapangan",
        group: "Sengkang / Ring",
      },
    ],
    compute: (i) => {
      const Lx = num(i.Lx);
      const Ly = num(i.Ly);
      const T = num(i.T);
      const nk = num(i.n, 1);
      const k = num(i.k, 0.02);
      const D1 = num(i.D1, 10);
      const n1 = num(i.n1, 4);
      const D2 = num(i.D2, 10);
      const n2 = num(i.n2, 0);
      const D3 = num(i.D3, 8);
      const R = num(i.R, 0.15);

      // Volume beton
      const v = Lx * Ly * T * nk;

      // Berat per meter (fallback ke formula 0.006165 × d²)
      const wPerM = (d: number) =>
        REBAR_WEIGHT[d] ?? 0.006165 * d * d;

      // Besi Utama: panjang = T × n1 × kolom
      const lUtama = T * n1 * nk;
      const wUtama = lUtama * wPerM(D1);

      // Besi Support: panjang = T × n2 × kolom
      const lSupport = T * n2 * nk;
      const wSupport = lSupport * wPerM(D2);

      // Ring/Begel: keliling inside (dikurangi 2 × selimut) + overlap 10cm
      const kelRing = 2 * (Lx - 2 * k + (Ly - 2 * k)) + 0.1;
      const jmlRingPerKolom = Math.ceil(T / R) + 1;
      const lRing = kelRing * jmlRingPerKolom * nk;
      const wRing = lRing * wPerM(D3);

      // Kawat ikat: 1% dari berat besi
      const wBesi = wUtama + wSupport + wRing;
      const wKawat = wBesi * 0.01;
      const totalBesi = wBesi + wKawat;

      // Bekisting: 4 sisi × tinggi × jumlah kolom
      const luasBekisting = 2 * (Lx + Ly) * T * nk;

      const formula = `${fmt(Lx, 3)} × ${fmt(Ly, 3)} × ${fmt(T, 2)} × ${fmt(nk, 0)} = ${fmt(v, 3)} m³`;

      return {
        value: v,
        formula,
        info: [
          {
            label: "Volume Beton",
            value: `${fmt(v, 3)} m³`,
            highlight: true,
          },
          {
            label: `Besi Utama (Ø${D1})`,
            value: `${fmt(lUtama, 2)} m → ${fmt(wUtama, 2)} kg`,
          },
          ...(n2 > 0
            ? [
                {
                  label: `Besi Support (Ø${D2})`,
                  value: `${fmt(lSupport, 2)} m → ${fmt(wSupport, 2)} kg`,
                },
              ]
            : []),
          {
            label: `Ring/Begel (Ø${D3})`,
            value: `${jmlRingPerKolom} bh × ${fmt(kelRing, 2)} m = ${fmt(lRing, 2)} m → ${fmt(wRing, 2)} kg`,
          },
          {
            label: "Kawat Ikat (1%)",
            value: `${fmt(wKawat, 2)} kg`,
          },
          {
            label: "TOTAL Besi + Kawat",
            value: `${fmt(totalBesi, 2)} kg`,
            highlight: true,
          },
          {
            label: "Bekisting Kolom",
            value: `${fmt(luasBekisting, 2)} m²`,
            highlight: true,
          },
        ],
      };
    },
    Diagram: ({ values }) => (
      <ColumnDiagram
        sideLabel={`${fmt(num(values.Lx, 0.15), 2)} × ${fmt(num(values.Ly, 0.15), 2)} m`}
        heightLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  {
    type: "plat_lantai",
    label: "Plat Lantai / Dak",
    description:
      "Plat lantai/dak beton bertulang RAB Pro level: tulangan 2-arah (X & Y) di 2 lapis (atas & bawah) + Kawat Ikat + bekisting. Output volume beton (m³).",
    outputUnit: "m³",
    outputLabel: "Volume Beton Plat",
    inputs: [
      // Dimensi
      {
        key: "P",
        label: "Panjang Plat",
        unit: "m",
        default: 6,
        min: 0,
        group: "Dimensi Plat",
      },
      {
        key: "L",
        label: "Lebar Plat",
        unit: "m",
        default: 4,
        min: 0,
        group: "Dimensi Plat",
      },
      {
        key: "T",
        label: "Tebal Plat",
        unit: "m",
        default: 0.12,
        min: 0.05,
        hint: "Standar 10–15 cm",
        group: "Dimensi Plat",
      },
      // Beton
      {
        key: "mutuBeton",
        label: "Mutu Beton",
        unit: "K",
        default: 225,
        group: "Spesifikasi Beton",
        options: [
          { value: 175, label: "K-175 (fc 14.5)" },
          { value: 225, label: "K-225 (fc 19.3)" },
          { value: 275, label: "K-275 (fc 22.5)" },
          { value: 300, label: "K-300 (fc 24.9)" },
        ],
      },
      // Tulangan Arah X
      {
        key: "Dx",
        label: "Ø Tulangan Arah X",
        unit: "mm",
        default: 10,
        group: "Tulangan Arah X (Memanjang)",
        options: [
          { value: 8, label: "Ø8 mm (0.39 kg/m)" },
          { value: 10, label: "Ø10 mm (0.62 kg/m)" },
          { value: 12, label: "Ø12 mm (0.89 kg/m)" },
          { value: 13, label: "Ø13 mm (1.04 kg/m)" },
        ],
      },
      {
        key: "Sx",
        label: "Jarak Tulangan Arah X",
        unit: "m",
        default: 0.15,
        min: 0.05,
        hint: "Standar 10–20 cm",
        group: "Tulangan Arah X (Memanjang)",
      },
      // Tulangan Arah Y
      {
        key: "Dy",
        label: "Ø Tulangan Arah Y",
        unit: "mm",
        default: 10,
        group: "Tulangan Arah Y (Melintang)",
        options: [
          { value: 8, label: "Ø8 mm (0.39 kg/m)" },
          { value: 10, label: "Ø10 mm (0.62 kg/m)" },
          { value: 12, label: "Ø12 mm (0.89 kg/m)" },
          { value: 13, label: "Ø13 mm (1.04 kg/m)" },
        ],
      },
      {
        key: "Sy",
        label: "Jarak Tulangan Arah Y",
        unit: "m",
        default: 0.15,
        min: 0.05,
        hint: "Standar 10–20 cm",
        group: "Tulangan Arah Y (Melintang)",
      },
      // Lapis
      {
        key: "lapis",
        label: "Jumlah Lapis",
        unit: "lapis",
        default: 2,
        group: "Konfigurasi",
        options: [
          { value: 1, label: "1 lapis (bawah saja)" },
          { value: 2, label: "2 lapis (atas & bawah)" },
        ],
      },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const T = num(i.T);
      const Dx = num(i.Dx, 10);
      const Sx = num(i.Sx, 0.15);
      const Dy = num(i.Dy, 10);
      const Sy = num(i.Sy, 0.15);
      const lapis = num(i.lapis, 2);

      // Volume beton
      const v = P * L * T;

      // Berat per meter (fallback ke formula 0.006165 × d²)
      const wPerM = (d: number) =>
        REBAR_WEIGHT[d] ?? 0.006165 * d * d;

      // Tulangan Arah X (memanjang sepanjang P, ditata sepanjang L)
      // Jumlah batang = ceil(L / Sx) + 1, panjang per batang = P
      const jmlX = Math.ceil(L / Sx) + 1;
      const lXPerLapis = jmlX * P;
      const lX = lXPerLapis * lapis;
      const wX = lX * wPerM(Dx);

      // Tulangan Arah Y (memanjang sepanjang L, ditata sepanjang P)
      const jmlY = Math.ceil(P / Sy) + 1;
      const lYPerLapis = jmlY * L;
      const lY = lYPerLapis * lapis;
      const wY = lY * wPerM(Dy);

      // Kawat ikat: 1% dari berat besi
      const wBesi = wX + wY;
      const wKawat = wBesi * 0.01;
      const totalBesi = wBesi + wKawat;

      // Bekisting: alas saja (atas terbuka)
      const luasBekisting = P * L;

      const formula = `${fmt(P, 2)} × ${fmt(L, 2)} × ${fmt(T, 3)} = ${fmt(v, 3)} m³`;

      return {
        value: v,
        formula,
        info: [
          {
            label: "Volume Beton",
            value: `${fmt(v, 3)} m³`,
            highlight: true,
          },
          {
            label: `Tulangan X (Ø${Dx} @${fmt(Sx * 100, 0)} cm)`,
            value: `${jmlX} bh × ${fmt(P, 2)} m × ${lapis} lapis = ${fmt(lX, 2)} m → ${fmt(wX, 2)} kg`,
          },
          {
            label: `Tulangan Y (Ø${Dy} @${fmt(Sy * 100, 0)} cm)`,
            value: `${jmlY} bh × ${fmt(L, 2)} m × ${lapis} lapis = ${fmt(lY, 2)} m → ${fmt(wY, 2)} kg`,
          },
          {
            label: "Kawat Ikat (1%)",
            value: `${fmt(wKawat, 2)} kg`,
          },
          {
            label: "TOTAL Besi + Kawat",
            value: `${fmt(totalBesi, 2)} kg`,
            highlight: true,
          },
          {
            label: "Bekisting Alas",
            value: `${fmt(luasBekisting, 2)} m²`,
            highlight: true,
          },
        ],
      };
    },
    Diagram: ({ values }) => (
      <SlabDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  {
    type: "dinding_pasangan",
    label: "Pasangan Dinding (Bata/Hebel)",
    description:
      "Pasangan dinding bata merah atau hebel/bataringan, dikurangi bukaan pintu/jendela. Output: luas pasangan (m²). Plus info: jumlah bata/hebel, volume mortar.",
    outputUnit: "m²",
    outputLabel: "Luas Pasangan Dinding",
    inputs: [
      // Dimensi
      {
        key: "P",
        label: "Panjang Dinding",
        unit: "m",
        default: 5,
        min: 0,
        group: "Dimensi Dinding",
      },
      {
        key: "T",
        label: "Tinggi Dinding",
        unit: "m",
        default: 3,
        min: 0,
        group: "Dimensi Dinding",
      },
      // Spesifikasi bata
      {
        key: "jenisBata",
        label: "Jenis Bata",
        unit: "",
        default: 1,
        group: "Spesifikasi Pasangan",
        options: [
          { value: 1, label: "Bata Merah 1/2 (70 buah/m²)" },
          { value: 2, label: "Bata Hebel/Ringan 7.5cm (8.33 buah/m²)" },
          { value: 3, label: "Bata Hebel/Ringan 10cm (8.33 buah/m²)" },
          { value: 4, label: "Bata Hebel/Ringan 12.5cm (8.33 buah/m²)" },
          { value: 5, label: "Bata Merah 1 (140 buah/m²)" },
        ],
      },
      {
        key: "adukan",
        label: "Adukan / Mortar",
        unit: "",
        default: 5,
        group: "Spesifikasi Pasangan",
        options: [
          { value: 2, label: "1:2 (utama struktur, kuat)" },
          { value: 3, label: "1:3 (semi struktural)" },
          { value: 4, label: "1:4 (umum, dinding biasa)" },
          { value: 5, label: "1:5 (ringan, dinding non-struktural)" },
          { value: 6, label: "1:6 (paling hemat)" },
        ],
      },
      // Bukaan terstruktur (pintu + jendela terpisah)
      {
        key: "jumlahPintu",
        label: "Jumlah Pintu",
        unit: "buah",
        default: 0,
        min: 0,
        group: "Bukaan",
      },
      {
        key: "luasPintu",
        label: "Luas per Pintu",
        unit: "m²",
        default: 1.8,
        min: 0,
        hint: "Default 0.9 × 2.0 = 1.8 m²",
        group: "Bukaan",
      },
      {
        key: "jumlahJendela",
        label: "Jumlah Jendela",
        unit: "buah",
        default: 0,
        min: 0,
        group: "Bukaan",
      },
      {
        key: "luasJendela",
        label: "Luas per Jendela",
        unit: "m²",
        default: 1.2,
        min: 0,
        hint: "Default 1.2 × 1.0 = 1.2 m²",
        group: "Bukaan",
      },
    ],
    compute: (i) => {
      const P = num(i.P);
      const T = num(i.T);
      const jenisBata = num(i.jenisBata, 1);
      const jumlahPintu = num(i.jumlahPintu, 0);
      const luasPintu = num(i.luasPintu, 1.8);
      const jumlahJendela = num(i.jumlahJendela, 0);
      const luasJendela = num(i.luasJendela, 1.2);

      const luasBukaan = jumlahPintu * luasPintu + jumlahJendela * luasJendela;
      const v = Math.max(0, P * T - luasBukaan);

      // Jumlah bata/hebel berdasarkan tipe
      let jumlahPerM2 = 70; // bata merah 1/2 default
      let labelMaterial = "Bata Merah 1/2";
      if (jenisBata === 2 || jenisBata === 3 || jenisBata === 4) {
        jumlahPerM2 = 8.33;
        labelMaterial = `Hebel ${jenisBata === 2 ? "7.5" : jenisBata === 3 ? "10" : "12.5"}cm`;
      } else if (jenisBata === 5) {
        jumlahPerM2 = 140;
        labelMaterial = "Bata Merah 1";
      }
      const totalBata = Math.ceil(v * jumlahPerM2);

      // Volume mortar — depend jenis & adukan, approx
      // Bata merah 1/2: ~0.045 m³ per m²
      // Hebel: ~0.012 m³ per m²
      const mortarPerM2 =
        jenisBata === 2 || jenisBata === 3 || jenisBata === 4 ? 0.012 : 0.045;
      const volMortar = v * mortarPerM2;

      const formula = `(${fmt(P, 2)} × ${fmt(T, 2)}) − ${fmt(luasBukaan, 2)} = ${fmt(v, 2)} m²`;

      return {
        value: v,
        formula,
        info: [
          {
            label: "Luas Bersih",
            value: `${fmt(v, 2)} m²`,
            highlight: true,
          },
          {
            label: "Luas Bukaan",
            value: `${fmt(luasBukaan, 2)} m²`,
          },
          {
            label: labelMaterial,
            value: `${totalBata.toLocaleString("id-ID")} buah`,
            highlight: true,
          },
          {
            label: "Vol. Mortar",
            value: `${fmt(volMortar, 3)} m³`,
          },
          {
            label: "Pintu + Jendela",
            value: `${jumlahPintu}P + ${jumlahJendela}J`,
          },
        ],
      };
    },
    Diagram: ({ values }) => {
      const luasBukaan =
        num(values.jumlahPintu, 0) * num(values.luasPintu, 1.8) +
        num(values.jumlahJendela, 0) * num(values.luasJendela, 1.2);
      return (
        <BrickWallDiagram
          pLabel={`P = ${fmt(num(values.P), 2)} m`}
          tLabel={`T = ${fmt(num(values.T), 2)} m`}
          bukaanText={
            luasBukaan > 0 ? `Bukaan: ${fmt(luasBukaan, 2)} m²` : undefined
          }
        />
      );
    },
  },

  {
    type: "plesteran",
    label: "Plesteran Dinding",
    description: "Luas plesteran (1 atau 2 sisi dinding).",
    outputUnit: "m²",
    outputLabel: "Luas Plesteran",
    inputs: [
      { key: "P", label: "Panjang Dinding", unit: "m", default: 5, min: 0 },
      { key: "T", label: "Tinggi Dinding", unit: "m", default: 3, min: 0 },
      {
        key: "sisi",
        label: "Jumlah Sisi",
        unit: "sisi",
        default: 2,
        min: 1,
        hint: "1 (1 sisi) atau 2 (depan-belakang)",
      },
      {
        key: "bukaan",
        label: "Total Luas Bukaan",
        unit: "m²",
        default: 0,
        min: 0,
      },
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
      <PlasterWallDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
        sisiText={`${fmt(num(values.sisi, 2), 0)} sisi`}
      />
    ),
  },

  // 7. Pondasi Batu Kali / Rollag (volume m³, trapezoid cross-section)
  {
    type: "pondasi_batu_kali",
    label: "Pondasi Batu Kali / Rollag",
    description:
      "Volume pondasi batu kali atau rollag — penampang trapesium (atas sempit, bawah lebar).",
    outputUnit: "m³",
    outputLabel: "Volume Pondasi",
    inputs: [
      { key: "P", label: "Panjang Total", unit: "m", default: 1, min: 0 },
      { key: "a", label: "Lebar Atas", unit: "m", default: 0.25, min: 0, hint: "Sisi sempit di atas" },
      { key: "b", label: "Lebar Bawah", unit: "m", default: 0.6, min: 0, hint: "Sisi lebar di dasar" },
      { key: "T", label: "Tinggi", unit: "m", default: 0.6, min: 0 },
    ],
    compute: (i) => {
      const P = num(i.P);
      const a = num(i.a);
      const b = num(i.b);
      const T = num(i.T);
      const v = P * ((a + b) / 2) * T;
      const formula = `${fmt(P, 2)} × ((${fmt(a, 2)} + ${fmt(b, 2)})/2) × ${fmt(T, 2)} = ${fmt(v, 3)} m³`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <TrapezoidFoundationDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        aLabel={`a = ${fmt(num(values.a), 2)} m`}
        bLabel={`b = ${fmt(num(values.b), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  // 8. Galian Saluran / Drainase / Parit
  {
    type: "galian_saluran",
    label: "Galian Saluran / Drainase",
    description: "Volume galian parit atau saluran drainase memanjang.",
    outputUnit: "m³",
    outputLabel: "Volume Galian",
    inputs: [
      { key: "P", label: "Panjang Saluran", unit: "m", default: 10, min: 0 },
      { key: "L", label: "Lebar", unit: "m", default: 0.3, min: 0 },
      { key: "T", label: "Kedalaman", unit: "m", default: 0.4, min: 0 },
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
      <TrenchDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  // 9. Timbunan / Pemadatan Tanah
  {
    type: "timbunan",
    label: "Timbunan / Urugan / Pemadatan",
    description: "Volume timbunan tanah/pasir yang dipadatkan dalam lapisan.",
    outputUnit: "m³",
    outputLabel: "Volume Timbunan",
    inputs: [
      { key: "P", label: "Panjang", unit: "m", default: 5, min: 0 },
      { key: "L", label: "Lebar", unit: "m", default: 5, min: 0 },
      { key: "T", label: "Tebal Total", unit: "m", default: 0.3, min: 0 },
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
      <FillDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  // 10. Atap (Genteng/Spandek) — luas miring
  {
    type: "atap",
    label: "Atap (Genteng / Spandek)",
    description:
      "Luas atap miring dihitung dari panjang × lebar / cos(sudut kemiringan).",
    outputUnit: "m²",
    outputLabel: "Luas Atap Miring",
    inputs: [
      { key: "P", label: "Panjang Bangunan", unit: "m", default: 8, min: 0 },
      { key: "L", label: "Lebar Bangunan", unit: "m", default: 6, min: 0 },
      {
        key: "sudut",
        label: "Sudut Kemiringan",
        unit: "°",
        default: 30,
        min: 0,
        hint: "Default 30° (umum buat genteng)",
      },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const sudut = num(i.sudut, 30);
      const cosSudut = Math.cos((sudut * Math.PI) / 180);
      const safeCos = cosSudut === 0 ? 1 : cosSudut;
      const v = (P * L) / safeCos;
      const formula = `(${fmt(P, 2)} × ${fmt(L, 2)}) / cos(${fmt(sudut, 0)}°) = ${fmt(v, 2)} m²`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <RoofDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        sudutLabel={`${fmt(num(values.sudut, 30), 0)}°`}
      />
    ),
  },

  // 11. Lantai Keramik / Granit
  {
    type: "lantai_keramik",
    label: "Lantai Keramik / Granit",
    description:
      "Luas lantai keramik atau granit dikurangi area bukaan/non-pasangan.",
    outputUnit: "m²",
    outputLabel: "Luas Lantai",
    inputs: [
      { key: "P", label: "Panjang Ruang", unit: "m", default: 4, min: 0 },
      { key: "L", label: "Lebar Ruang", unit: "m", default: 3, min: 0 },
      {
        key: "kurang",
        label: "Luas Dikurangi",
        unit: "m²",
        default: 0,
        min: 0,
        hint: "Area kolom, bukaan, dst (opsional)",
      },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const k = num(i.kurang);
      const v = Math.max(0, P * L - k);
      const formula = `(${fmt(P, 2)} × ${fmt(L, 2)}) − ${fmt(k, 2)} = ${fmt(v, 2)} m²`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <FloorTileDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        bukaanText={
          num(values.kurang) > 0
            ? `Dikurangi: ${fmt(num(values.kurang), 2)} m²`
            : undefined
        }
      />
    ),
  },

  // 12. Cat Dinding
  {
    type: "cat_dinding",
    label: "Cat Dinding",
    description:
      "Luas pengecatan dinding (1 atau 2 sisi) dikurangi luas bukaan.",
    outputUnit: "m²",
    outputLabel: "Luas Cat",
    inputs: [
      { key: "P", label: "Panjang Dinding", unit: "m", default: 5, min: 0 },
      { key: "T", label: "Tinggi Dinding", unit: "m", default: 3, min: 0 },
      {
        key: "sisi",
        label: "Jumlah Sisi",
        unit: "sisi",
        default: 2,
        min: 1,
        hint: "1 (luar) atau 2 (luar+dalam)",
      },
      {
        key: "bukaan",
        label: "Total Luas Bukaan",
        unit: "m²",
        default: 0,
        min: 0,
      },
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
      <PaintWallDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
        sisiText={`${fmt(num(values.sisi, 2), 0)} sisi`}
      />
    ),
  },

  // 13. Bekisting Kolom — luas papan formwork m²
  {
    type: "bekisting_kolom",
    label: "Bekisting Kolom",
    description:
      "Luas papan bekisting (cetakan) untuk kolom = 4 sisi × tinggi × jumlah.",
    outputUnit: "m²",
    outputLabel: "Luas Bekisting",
    inputs: [
      { key: "sisi", label: "Sisi Penampang", unit: "m", default: 0.2, min: 0 },
      { key: "T", label: "Tinggi Kolom", unit: "m", default: 3, min: 0 },
      { key: "n", label: "Jumlah Kolom", unit: "buah", default: 1, min: 1 },
    ],
    compute: (i) => {
      const s = num(i.sisi);
      const T = num(i.T);
      const n = num(i.n, 1);
      const v = 4 * s * T * n;
      const formula = `4 × ${fmt(s, 3)} × ${fmt(T, 2)} × ${fmt(n, 0)} = ${fmt(v, 2)} m²`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <FormworkColumnDiagram
        sLabel={`s = ${fmt(num(values.sisi), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  // 14. Bekisting Balok — luas papan m² (2 sisi + 1 bawah)
  {
    type: "bekisting_balok",
    label: "Bekisting Balok",
    description:
      "Luas bekisting balok = (2 × tinggi + lebar) × panjang. Sisi atas terbuka.",
    outputUnit: "m²",
    outputLabel: "Luas Bekisting",
    inputs: [
      { key: "P", label: "Panjang Balok", unit: "m", default: 5, min: 0 },
      { key: "L", label: "Lebar Balok", unit: "m", default: 0.2, min: 0 },
      { key: "T", label: "Tinggi Balok", unit: "m", default: 0.4, min: 0 },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const T = num(i.T);
      const v = (2 * T + L) * P;
      const formula = `(2 × ${fmt(T, 2)} + ${fmt(L, 2)}) × ${fmt(P, 2)} = ${fmt(v, 2)} m²`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <FormworkBeamDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
      />
    ),
  },

  // 15. Bekisting Plat — luas plywood bawah
  {
    type: "bekisting_plat",
    label: "Bekisting Plat / Dak",
    description:
      "Luas plywood bekisting plat dari sisi bawah = panjang × lebar.",
    outputUnit: "m²",
    outputLabel: "Luas Bekisting",
    inputs: [
      { key: "P", label: "Panjang", unit: "m", default: 6, min: 0 },
      { key: "L", label: "Lebar", unit: "m", default: 4, min: 0 },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const v = P * L;
      const formula = `${fmt(P, 2)} × ${fmt(L, 2)} = ${fmt(v, 2)} m²`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <FormworkSlabDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
      />
    ),
  },

  // 16. Pembesian / Tulangan (kg)
  {
    type: "pembesian",
    label: "Pembesian / Tulangan",
    description:
      "Berat besi tulangan (kg) = panjang × jumlah × berat per meter (sesuai diameter).",
    outputUnit: "kg",
    outputLabel: "Berat Tulangan",
    inputs: [
      {
        key: "P",
        label: "Panjang per Batang",
        unit: "m",
        default: 12,
        min: 0,
        hint: "Standar batang besi 12 m",
      },
      { key: "n", label: "Jumlah Batang", unit: "btg", default: 10, min: 0 },
      {
        key: "beratPerM",
        label: "Berat per Meter",
        unit: "kg/m",
        default: 0.617,
        min: 0,
        hint: "Ø10mm=0.617, Ø12mm=0.888, Ø13mm=1.04, Ø16mm=1.578",
      },
    ],
    compute: (i) => {
      const P = num(i.P);
      const n = num(i.n);
      const w = num(i.beratPerM, 0.617);
      const v = P * n * w;
      const formula = `${fmt(P, 2)} × ${fmt(n, 0)} × ${fmt(w, 3)} = ${fmt(v, 2)} kg`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <RebarDiagram
        diaLabel={`${fmt(num(values.beratPerM, 0.617), 3)} kg/m`}
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        nLabel={`n = ${fmt(num(values.n), 0)} btg`}
      />
    ),
  },

  // 17. Plafon + Rangka (m²)
  {
    type: "plafon",
    label: "Plafon + Rangka",
    description: "Luas pemasangan plafon (gypsum/PVC/GRC) plus rangka hollow.",
    outputUnit: "m²",
    outputLabel: "Luas Plafon",
    inputs: [
      { key: "P", label: "Panjang Ruang", unit: "m", default: 5, min: 0 },
      { key: "L", label: "Lebar Ruang", unit: "m", default: 4, min: 0 },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const v = P * L;
      const formula = `${fmt(P, 2)} × ${fmt(L, 2)} = ${fmt(v, 2)} m²`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <CeilingDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
      />
    ),
  },

  // 18. Bouwplank / Profil — keliling m' + jumlah patok + vol kayu
  {
    type: "bowplank",
    label: "Bouwplank / Profil",
    description:
      "Pemasangan bouwplank di sekeliling lahan (offset dari struktur). Output utama: panjang bouwplank (m') untuk dipakai dengan AHSP. Plus info: jumlah patok, volume kayu papan & patok.",
    outputUnit: "m'",
    outputLabel: "Panjang Bouwplank",
    inputs: [
      // Dimensi Utama — geometri lahan & bangunan
      {
        key: "P",
        label: "Panjang Bangunan",
        unit: "m",
        default: 8,
        min: 0,
        hint: "Panjang struktur (tanpa offset bouwplank)",
        group: "Dimensi Lahan & Bangunan",
      },
      {
        key: "L",
        label: "Lebar Bangunan",
        unit: "m",
        default: 6,
        min: 0,
        hint: "Lebar struktur",
        group: "Dimensi Lahan & Bangunan",
      },
      {
        key: "offset",
        label: "Offset Bouwplank",
        unit: "m",
        default: 1,
        min: 0,
        hint: "Jarak bouwplank ke pinggir struktur. Standar 1 m.",
        group: "Dimensi Lahan & Bangunan",
      },
      // Spesifikasi patok
      {
        key: "jarakPatok",
        label: "Jarak Antar Patok",
        unit: "m",
        default: 1.5,
        min: 0.5,
        hint: "Standar 1.5–2 m",
        group: "Spesifikasi Patok",
      },
      {
        key: "tinggiPatok",
        label: "Tinggi Patok di Atas Tanah",
        unit: "m",
        default: 0.5,
        min: 0,
        hint: "Tinggi yang terlihat. Tertanam +30 cm.",
        group: "Spesifikasi Patok",
      },
      {
        key: "sisiPatok",
        label: "Sisi Penampang Patok",
        unit: "m",
        default: 0.05,
        min: 0,
        hint: "Default 5/7 cm = 0.05 m (kayu kaso)",
        group: "Spesifikasi Patok",
      },
      // Spesifikasi papan profil
      {
        key: "lebarPapan",
        label: "Lebar Papan Profil",
        unit: "m",
        default: 0.2,
        min: 0,
        hint: "Default 20 cm = 0.20 m",
        group: "Spesifikasi Papan Profil",
      },
      {
        key: "tebalPapan",
        label: "Tebal Papan Profil",
        unit: "m",
        default: 0.02,
        min: 0,
        hint: "Default 2 cm = 0.02 m",
        group: "Spesifikasi Papan Profil",
      },
    ],
    compute: (i) => {
      const P = num(i.P);
      const L = num(i.L);
      const offset = num(i.offset, 1);
      const jarakPatok = num(i.jarakPatok, 1.5);
      const tinggiPatok = num(i.tinggiPatok, 0.5);
      const sisiPatok = num(i.sisiPatok, 0.05);
      const lebarPapan = num(i.lebarPapan, 0.2);
      const tebalPapan = num(i.tebalPapan, 0.02);

      const panjangPerimeter = P + 2 * offset;
      const lebarPerimeter = L + 2 * offset;
      const keliling = 2 * (panjangPerimeter + lebarPerimeter);

      // Jumlah patok = (keliling / jarak) + 4 corners (rounded up)
      const jumlahPatok = Math.max(
        4,
        Math.ceil(keliling / jarakPatok) + 4,
      );

      // Volume kayu patok (tertanam 30 cm + atas tinggiPatok)
      const tinggiTotalPatok = tinggiPatok + 0.3;
      const volPatok = jumlahPatok * sisiPatok * sisiPatok * tinggiTotalPatok;

      // Volume kayu papan profil (= keliling × lebar × tebal)
      const volPapan = keliling * lebarPapan * tebalPapan;

      const totalVolKayu = volPatok + volPapan;

      const formula = `2 × ((${fmt(P, 2)} + 2×${fmt(offset, 2)}) + (${fmt(L, 2)} + 2×${fmt(offset, 2)})) = ${fmt(keliling, 2)} m'`;

      return {
        value: keliling,
        formula,
        info: [
          {
            label: "Keliling Lahan",
            value: `${fmt(panjangPerimeter, 2)} × ${fmt(lebarPerimeter, 2)} m`,
          },
          {
            label: "Jumlah Patok",
            value: `${jumlahPatok} buah`,
            highlight: true,
          },
          {
            label: "Vol. Kayu Patok",
            value: `${fmt(volPatok, 4)} m³`,
          },
          {
            label: "Vol. Kayu Papan",
            value: `${fmt(volPapan, 4)} m³`,
          },
          {
            label: "Total Kayu",
            value: `${fmt(totalVolKayu, 4)} m³`,
            highlight: true,
          },
          {
            label: "Tinggi Patok Total",
            value: `${fmt(tinggiTotalPatok, 2)} m (${fmt(tinggiPatok, 2)} + 0.30 tertanam)`,
          },
        ],
      };
    },
    Diagram: ({ values }) => (
      <BouwplankDiagramRich
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        lLabel={`L = ${fmt(num(values.L), 2)} m`}
        offsetLabel={`offset = ${fmt(num(values.offset, 1), 2)} m`}
        jarakLabel={`@ ${fmt(num(values.jarakPatok, 1.5), 2)} m`}
        tinggiPatokVal={num(values.tinggiPatok, 0.5)}
      />
    ),
  },

  // 19. Atap Kuda-kuda Kayu (volume m³)
  {
    type: "kuda_kuda",
    label: "Atap Kuda-kuda Kayu",
    description:
      "Volume kayu kuda-kuda = (luas penampang × panjang × jumlah elemen).",
    outputUnit: "m³",
    outputLabel: "Volume Kayu",
    inputs: [
      { key: "bentang", label: "Bentang", unit: "m", default: 6, min: 0 },
      { key: "tinggi", label: "Tinggi Puncak", unit: "m", default: 1.8, min: 0 },
      {
        key: "penampang",
        label: "Luas Penampang Balok",
        unit: "m²",
        default: 0.0096,
        min: 0,
        hint: "Default 8/12 cm = 0.0096 m²",
      },
      { key: "n", label: "Jumlah Kuda-kuda", unit: "set", default: 5, min: 1 },
    ],
    compute: (i) => {
      const b = num(i.bentang);
      const t = num(i.tinggi);
      const a = num(i.penampang, 0.0096);
      const n = num(i.n, 1);
      // Total panjang elemen kuda-kuda dasar (rafter + bottom + post + 2 strut)
      const rafter = Math.sqrt(Math.pow(b / 2, 2) + Math.pow(t, 2));
      const totalLen = b + 2 * rafter + t + 2 * 1.2; // strut diasumsi 1.2m
      const v = totalLen * a * n;
      const formula = `${fmt(totalLen, 2)} × ${fmt(a, 4)} × ${fmt(n, 0)} = ${fmt(v, 3)} m³`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <TrussDiagram
        bentangLabel={`B = ${fmt(num(values.bentang), 2)} m`}
        tinggiLabel={`H = ${fmt(num(values.tinggi), 2)} m`}
      />
    ),
  },

  // 20. Pipa (PVC/Air/Sanitasi)
  {
    type: "pipa",
    label: "Pipa (Air Bersih / Sanitasi)",
    description:
      "Panjang pipa untuk instalasi air bersih, air kotor, atau air buangan.",
    outputUnit: "m'",
    outputLabel: "Panjang Pipa",
    inputs: [
      { key: "P", label: "Panjang Pipa", unit: "m", default: 10, min: 0 },
      { key: "n", label: "Jumlah Jalur", unit: "jalur", default: 1, min: 1 },
      {
        key: "diameter",
        label: "Diameter",
        unit: "inch",
        default: 0.5,
        min: 0,
        hint: "1/2 inch=0.5, 3/4=0.75, 1=1, 4 inch=4 (sanitasi)",
      },
    ],
    compute: (i) => {
      const P = num(i.P);
      const n = num(i.n, 1);
      const v = P * n;
      const formula = `${fmt(P, 2)} × ${fmt(n, 0)} = ${fmt(v, 2)} m'`;
      return { value: v, formula };
    },
    Diagram: ({ values }) => (
      <PipeDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        diaLabel={`Ø ${fmt(num(values.diameter, 0.5), 2)}"`}
      />
    ),
  },
  // ─────────────────────────────────────────────────────────────────────────
  // Lumsum (LS) — pekerjaan paket non-volumetric
  // Hidden dari dropdown (user pilih satuan "LS" + Manual volume). Definisi
  // di-keep biar item lama yang udah pakai calculatorType="lumsum" gak rusak.
  // ─────────────────────────────────────────────────────────────────────────
  {
    type: "lumsum",
    label: "Lumsum (LS) — Paket Tetap",
    description:
      "Pekerjaan paket non-volumetric. Misal mobilisasi/demobilisasi, papan nama proyek, foto dokumentasi, asuransi, K3, pengamanan, listrik & air kerja.",
    outputUnit: "LS",
    outputLabel: "Jumlah Paket",
    hidden: true,
    inputs: [
      {
        key: "n",
        label: "Jumlah Paket",
        unit: "LS",
        default: 1,
        min: 0,
        hint: "Biasanya 1 LS. Isi >1 kalau ada beberapa paket terpisah.",
        group: "Paket",
      },
    ],
    compute: (i) => {
      const n = num(i.n, 1);
      const formula = `${fmt(n, 2)} LS`;
      return { value: n, formula };
    },
    Diagram: ({ values }) => (
      <LumsumDiagram n={num(values.n, 1)} />
    ),
  },
];

export function getCalculator(type: string | null | undefined): CalcDef | null {
  if (!type) return null;
  return CALCULATORS.find((c) => c.type === type) ?? null;
}
