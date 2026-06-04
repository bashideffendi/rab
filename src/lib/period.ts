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

/** Tanggal kalender WIB (Asia/Jakarta) sbg string 'YYYY-MM-DD'. Penting: server
 *  Vercel jalan di UTC; tanpa ini, batas periode geser ke 07:00 WIB (off-by-one
 *  tiap pagi utk daily). en-CA format = ISO YYYY-MM-DD. */
function jakartaDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(d);
}

/** Selisih hari kalender murni antara 2 tanggal 'YYYY-MM-DD' (anti-skew TZ). */
function calendarDaysBetween(startStr: string, endStr: string): number {
  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [ey, em, ed] = endStr.split("-").map(Number);
  return Math.floor(
    (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000,
  );
}

/**
 * Hitung nomor periode berjalan project (1-based) dari tanggal mulai, pakai
 * TANGGAL KALENDER WIB (bukan instant server) supaya pergantian periode jatuh
 * di tengah malam WIB, bukan 07:00 WIB.
 *
 * - Weekly: hari 0-6 → periode 1, hari 7-13 → periode 2, dst.
 * - Daily:  hari 0   → periode 1, hari 1   → periode 2, dst.
 */
export function computeCurrentPeriod(
  startedAt: string | null,
  createdAt: Date,
  period: PeriodConfig,
): number {
  const startStr = startedAt ?? jakartaDateStr(createdAt);
  const todayStr = jakartaDateStr(new Date());
  const days = calendarDaysBetween(startStr, todayStr);
  if (days < 0) return 1;
  return Math.max(1, Math.floor(days / period.daysPerPeriod) + 1);
}

/**
 * Tanggal kalender awal periode ke-N (1-based) dari tanggal mulai project.
 * Periode 1 = startedAt; periode N = startedAt + (N-1)×daysPerPeriod hari.
 * Dibangun via Date.UTC (UTC-midnight) supaya komponen tanggalnya stabil lintas
 * timezone server — consumer format pakai timeZone "Asia/Jakarta". Null kalau
 * startedAt belum diisi.
 */
export function dateForPeriod(
  startedAt: string | null,
  n: number,
  period: PeriodConfig,
): Date | null {
  if (!startedAt) return null;
  const [y, m, d] = startedAt.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + (n - 1) * period.daysPerPeriod));
}
