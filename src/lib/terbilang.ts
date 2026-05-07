/**
 * Convert number ke "terbilang" Bahasa Indonesia.
 *
 * Examples:
 *  0 → "nol"
 *  1 → "satu"
 *  11 → "sebelas"
 *  100 → "seratus"
 *  1000 → "seribu"
 *  1500000 → "satu juta lima ratus ribu"
 *  900870.40 → "sembilan ratus ribu delapan ratus tujuh puluh"
 *  (decimals di-truncate, kita pakai integer rupiah)
 */

const ANGKA = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];

function bawahSeribu(n: number): string {
  if (n === 0) return "";
  if (n < 12) return ANGKA[n];
  if (n < 20) return `${ANGKA[n - 10]} belas`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return `${ANGKA[tens]} puluh${ones ? " " + ANGKA[ones] : ""}`;
  }
  if (n < 200) {
    const rest = n - 100;
    return `seratus${rest ? " " + bawahSeribu(rest) : ""}`;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    return `${ANGKA[hundreds]} ratus${rest ? " " + bawahSeribu(rest) : ""}`;
  }
  return "";
}

export function terbilang(input: number | string): string {
  let n: number;
  if (typeof input === "string") {
    const cleaned = input.replace(/[^\d.\-]/g, "");
    n = Math.floor(Number(cleaned));
  } else {
    n = Math.floor(input);
  }
  if (!Number.isFinite(n)) return "nol";
  if (n < 0) return "minus " + terbilang(-n);
  if (n === 0) return "nol";

  // Pecah jadi triliun, miliar, juta, ribu, ratusan
  const triliun = Math.floor(n / 1_000_000_000_000);
  const miliar = Math.floor((n % 1_000_000_000_000) / 1_000_000_000);
  const juta = Math.floor((n % 1_000_000_000) / 1_000_000);
  const ribu = Math.floor((n % 1_000_000) / 1_000);
  const sisa = n % 1_000;

  const parts: string[] = [];

  if (triliun > 0) {
    if (triliun === 1) parts.push("satu triliun");
    else parts.push(`${bawahSeribu(triliun)} triliun`);
  }
  if (miliar > 0) {
    if (miliar === 1) parts.push("satu miliar");
    else parts.push(`${bawahSeribu(miliar)} miliar`);
  }
  if (juta > 0) {
    if (juta === 1) parts.push("satu juta");
    else parts.push(`${bawahSeribu(juta)} juta`);
  }
  if (ribu > 0) {
    if (ribu === 1) parts.push("seribu");
    else parts.push(`${bawahSeribu(ribu)} ribu`);
  }
  if (sisa > 0) {
    parts.push(bawahSeribu(sisa));
  }

  return parts.join(" ").trim();
}

/**
 * Format ke "Rupiah" — capitalize first letter.
 */
export function terbilangRupiah(n: number | string): string {
  const t = terbilang(n);
  // Capitalize first
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return `${cap} rupiah`;
}

/**
 * Round number to nearest multiple. Default 1000 (rupiah).
 */
export function roundToNearest(value: number, step = 1000): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}
