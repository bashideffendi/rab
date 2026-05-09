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
};

export type ComputeResult = {
  value: number;
  formula: string;
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
// Calculator definitions
// ─────────────────────────────────────────────────────────────────────────────

export const CALCULATORS: CalcDef[] = [
  {
    type: "galian_tapak",
    label: "Galian / Pondasi Tapak",
    description:
      "Volume galian atau pondasi tapak/menerus dari panjang × lebar × tinggi.",
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
      "Volume beton untuk sloof atau balok lurus dengan tulangan.",
    outputUnit: "m³",
    outputLabel: "Volume Beton",
    inputs: [
      { key: "P", label: "Panjang Total", unit: "m", default: 1, min: 0 },
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
    description: "Volume beton kolom dengan tulangan (penampang persegi).",
    outputUnit: "m³",
    outputLabel: "Volume Beton Kolom",
    inputs: [
      {
        key: "sisi",
        label: "Sisi Penampang",
        unit: "m",
        default: 0.2,
        min: 0,
        hint: "Misal 0.2 untuk kolom 20×20 cm",
      },
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

  {
    type: "plat_lantai",
    label: "Plat Lantai / Dak",
    description: "Volume beton plat lantai atau dak datar dengan tulangan.",
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
      "Luas pasangan dinding dikurangi luas bukaan (pintu/jendela).",
    outputUnit: "m²",
    outputLabel: "Luas Pasangan Dinding",
    inputs: [
      { key: "P", label: "Panjang Dinding", unit: "m", default: 5, min: 0 },
      { key: "T", label: "Tinggi Dinding", unit: "m", default: 3, min: 0 },
      {
        key: "bukaan",
        label: "Total Luas Bukaan",
        unit: "m²",
        default: 0,
        min: 0,
        hint: "Jumlah luas pintu + jendela",
      },
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
      <BrickWallDiagram
        pLabel={`P = ${fmt(num(values.P), 2)} m`}
        tLabel={`T = ${fmt(num(values.T), 2)} m`}
        bukaanText={
          num(values.bukaan) > 0
            ? `Bukaan: ${fmt(num(values.bukaan), 2)} m²`
            : undefined
        }
      />
    ),
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
];

export function getCalculator(type: string | null | undefined): CalcDef | null {
  if (!type) return null;
  return CALCULATORS.find((c) => c.type === type) ?? null;
}
