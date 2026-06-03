import { roundToNearest } from "@/lib/terbilang";

/**
 * Rekapitulasi RAB — SATU sumber kebenaran rumus, dipakai UI (items-section),
 * print/PDF, dan Excel export biar total SELALU sama di mana pun dirender.
 *
 * Urutan pos sesuai Permen PUPR 8/2023:
 *   Subtotal (biaya langsung)
 *   + Overhead & Keuntungan  (overheadPct% × subtotal)  — Pasal 11 (3): 10–15%
 *   + SMKK                   (smkkPct% × subtotal)       — Pasal 22: pos tersendiri
 *   = DPP (dasar pengenaan PPN)
 *   + PPN                    (ppnPct% × DPP)
 *   = Total → dibulatkan
 *
 * Overhead & SMKK dua-duanya % dari biaya langsung, dan dua-duanya kena PPN.
 */

export type RekapInput = {
  overheadPercent: number | string;
  smkkPercent: number | string;
  ppnPercent: number | string;
  dibulatkanKe: number;
};

export type Rekap = {
  subtotal: number;
  overheadPct: number;
  overhead: number;
  smkkPct: number;
  smkk: number;
  ppnPct: number;
  dpp: number;
  ppn: number;
  total: number;
  dibulatkan: number;
};

function num(v: number | string): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function computeRekap(subtotal: number, cfg: RekapInput): Rekap {
  const overheadPct = num(cfg.overheadPercent);
  const smkkPct = num(cfg.smkkPercent);
  const ppnPct = num(cfg.ppnPercent);

  const overhead = subtotal * (overheadPct / 100);
  const smkk = subtotal * (smkkPct / 100);
  const dpp = subtotal + overhead + smkk;
  const ppn = dpp * (ppnPct / 100);
  const total = dpp + ppn;
  const dibulatkan = roundToNearest(total, cfg.dibulatkanKe);

  return {
    subtotal,
    overheadPct,
    overhead,
    smkkPct,
    smkk,
    ppnPct,
    dpp,
    ppn,
    total,
    dibulatkan,
  };
}

/** Label basis perhitungan untuk ditempel di rekap (UI/print/Excel). */
export const BASIS_REGULASI = "Basis: Permen PUPR 8/2023 + SE DJBK 47/2026";

/** Dasar hukum tarif PPN efektif jasa konstruksi (untuk hint/keterangan). */
export const PPN_DASAR_HUKUM =
  "PPN efektif 11% jasa konstruksi non-mewah (UU HPP jo. PMK 131/2024).";
