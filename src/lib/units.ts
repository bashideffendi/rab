/**
 * Satuan standar RAB konstruksi Indonesia.
 *
 * Dipakai di datalist suggestion + normalizer untuk field "Satuan" custom
 * item. User tetep boleh ketik satuan unik di luar list ini (datalist =
 * suggestion, bukan validation). Normalizer cuma map typo umum ke bentuk
 * canonical.
 */

export const STANDARD_UNITS = [
  "m³",
  "m²",
  "m'",
  "bh",
  "unit",
  "titik",
  "kg",
  "ton",
  "LS",
  "set",
  "jam",
  "hari",
  "trip",
  "bulan",
  "lonjor",
  "lbr",
  "sak",
  "ltr",
  "OJ",
  "OH",
  "OB",
];

/**
 * Map varian umum (typo / case beda / sinonim) → bentuk canonical.
 * Lookup pakai lower-case input.
 */
const NORMALIZE_MAP: Record<string, string> = {
  // Kubik
  "m3": "m³",
  "m^3": "m³",
  "m**3": "m³",
  "kubik": "m³",
  // Persegi
  "m2": "m²",
  "m^2": "m²",
  "m**2": "m²",
  "persegi": "m²",
  // Meter lari / lurus
  "m1": "m'",
  "m^1": "m'",
  "ml": "m'",
  "m`": "m'",
  // Lumsum
  "ls": "LS",
  "lump sum": "LS",
  "lumpsum": "LS",
  "lumsum": "LS",
  // Orang-jam
  "oj": "OJ",
  "orang jam": "OJ",
  "orang-jam": "OJ",
  // Orang-hari
  "oh": "OH",
  "orang hari": "OH",
  "orang-hari": "OH",
  // Orang-bulan
  "ob": "OB",
  "orang bulan": "OB",
  "orang-bulan": "OB",
  // Buah
  "buah": "bh",
  // Lembar
  "lembar": "lbr",
  // Lonjor / batang
  "btg": "lonjor",
  "batang": "lonjor",
  // Sak / zak (semen)
  "zak": "sak",
  // Liter
  "liter": "ltr",
  "l": "ltr",
  // Trip / rit
  "rit": "trip",
};

/**
 * Normalize input satuan ke bentuk canonical kalau dikenal, else return
 * raw (trimmed). Aman dipanggil di onBlur.
 */
export function normalizeUnit(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  return NORMALIZE_MAP[lower] ?? trimmed;
}
