/**
 * Period config untuk Schedule + Progress tracking.
 *
 * `weekly` (default) = 1 periode = 7 hari, label "Mg" (minggu).
 * `daily`            = 1 periode = 1 hari, label "Hr" (hari).
 *
 * DB columns `start_week`, `duration_weeks`, `week_num` namanya tetap weekly,
 * tapi makna angkanya tergantung project.progressPeriod. UI rendering pakai
 * helper di sini supaya label & computation konsisten.
 */

export type ProgressPeriod = "weekly" | "daily";

export type PeriodConfig = {
  type: ProgressPeriod;
  /** Hari per 1 periode (7 untuk weekly, 1 untuk daily). */
  daysPerPeriod: number;
  /** Singkatan UI: "Mg" / "Hr". */
  abbrev: string;
  /** Label panjang: "Minggu" / "Hari". */
  label: string;
  /** Label plural: "minggu" / "hari" (lowercase, untuk sentence). */
  pluralLower: string;
};

const WEEKLY: PeriodConfig = {
  type: "weekly",
  daysPerPeriod: 7,
  abbrev: "Mg",
  label: "Minggu",
  pluralLower: "minggu",
};

const DAILY: PeriodConfig = {
  type: "daily",
  daysPerPeriod: 1,
  abbrev: "Hr",
  label: "Hari",
  pluralLower: "hari",
};

export const PROGRESS_PERIODS: ReadonlyArray<{
  value: ProgressPeriod;
  label: string;
  hint: string;
}> = [
  {
    value: "weekly",
    label: "Mingguan",
    hint: "Cocok untuk project ≥ 1 bulan. Tracking per minggu.",
  },
  {
    value: "daily",
    label: "Harian",
    hint: "Cocok untuk project pendek (≤ 60 hari). Tracking per hari.",
  },
];

export function getPeriodConfig(period: string | null | undefined): PeriodConfig {
  return period === "daily" ? DAILY : WEEKLY;
}

export function isProgressPeriod(v: unknown): v is ProgressPeriod {
  return v === "weekly" || v === "daily";
}

/**
 * Hitung nomor periode berjalan project (1-based) berdasarkan tanggal mulai.
 *
 * - Weekly: hari 0-6 → periode 1, hari 7-13 → periode 2, dst.
 * - Daily:  hari 0   → periode 1, hari 1   → periode 2, dst.
 */
export function computeCurrentPeriod(
  startedAt: string | null,
  createdAt: Date,
  period: PeriodConfig,
): number {
  const start = startedAt ? new Date(`${startedAt}T00:00:00`) : createdAt;
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  if (diffMs < 0) return 1;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(days / period.daysPerPeriod) + 1);
}

/**
 * Tanggal kalender awal periode ke-N (1-based) dari tanggal mulai project.
 * Periode 1 = startedAt; periode N = startedAt + (N-1)×daysPerPeriod hari.
 * Null kalau startedAt belum diisi.
 */
export function dateForPeriod(
  startedAt: string | null,
  n: number,
  period: PeriodConfig,
): Date | null {
  if (!startedAt) return null;
  const d = new Date(`${startedAt}T00:00:00`);
  d.setDate(d.getDate() + (n - 1) * period.daysPerPeriod);
  return d;
}
