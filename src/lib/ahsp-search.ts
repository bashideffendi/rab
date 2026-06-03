/**
 * Preprocessor query AHSP search.
 *
 * Dua masalah yang dibenerin di sini:
 *  1. Mutu beton kolokial K-xxx (kg/cm²) ≠ notasi AHSP PUPR f'c (MPa).
 *     Praktisi ngetik "beton K-225", tapi data nyimpen "f'c 19,3 MPa".
 *  2. Query multi-kata ("beton K-225") dulu dimatch sebagai satu substring
 *     kontigu (`%beton K-225%`) → nyaris gak pernah cocok. Sekarang
 *     di-tokenisasi: tiap token harus cocok (AND), tapi tiap token boleh
 *     cocok via salah satu alias-nya (OR).
 *
 * Pure function, no DB — dipakai di /api/ahsp/search dan buat hint di picker.
 */

// Konversi mutu beton karakteristik K (kg/cm², kubus) → f'c (MPa, silinder),
// mengikuti tabel ekuivalensi SNI yang dipakai di AHSP PUPR.
const K_TO_FC: Record<string, string> = {
  "100": "7,4",
  "125": "9,8",
  "150": "12,2",
  "175": "14,5",
  "200": "16,9",
  "225": "19,3",
  "250": "21,7",
  "275": "24",
  "300": "26,4",
  "350": "31,2",
  "400": "33,2",
  "450": "37,4",
  "500": "41,5",
};

// Sinonim istilah BOW/SNI/lapangan → istilah yang dipakai di nama AHSP.
const SYNONYMS: Record<string, string[]> = {
  cor: ["beton"],
  begel: ["sengkang"],
  sengkang: ["begel"],
  aanstamping: ["batu kosong"],
  anstamping: ["batu kosong"],
  rabat: ["lantai kerja"],
  bobok: ["bongkar"],
  bowplank: ["bouwplank"],
  bouwplank: ["bowplank"],
};

/** Normalisasi K-grade jadi satu token "Kxxx" ("K-225", "K 225" → "K225"). */
function normalizeGrades(query: string): string {
  return query.replace(/\bK[-\s]?(\d{2,3})\b/gi, (_m, d) => `K${d}`);
}

/**
 * Pecah query jadi token; tiap token → daftar pola alias (string mentah, tanpa %).
 * Caller bikin pattern `%pola%` dan AND antar-token, OR antar-pola.
 */
export function expandQuery(query: string): string[][] {
  const normalized = normalizeGrades(query.trim());
  const rawTokens = normalized.split(/\s+/).filter(Boolean);

  return rawTokens.map((tok) => {
    const patterns = new Set<string>([tok]);

    const grade = tok.match(/^K(\d{2,3})$/i);
    if (grade) {
      const k = grade[1];
      const fc = K_TO_FC[k];
      if (fc) {
        patterns.add(fc); // "19,3"
        patterns.add(fc.replace(",", ".")); // "19.3"
        patterns.add(`K ${k}`);
        patterns.add(`K-${k}`);
        patterns.add(`K${k}`);
        patterns.add(k); // "225" (mis. nama mengandung "(K 225)")
      }
    }

    const syn = SYNONYMS[tok.toLowerCase()];
    if (syn) syn.forEach((s) => patterns.add(s));

    return [...patterns];
  });
}

/**
 * Kalau query mengandung mutu K-grade yang dikenal, balikin padanan f'c-nya
 * buat ditampilkan sebagai hint di picker ("≈ f'c 19,3 MPa (K-225)").
 */
export function fcHintFor(query: string): { k: string; fc: string } | null {
  const m = query.match(/\bK[-\s]?(\d{2,3})\b/i);
  if (!m) return null;
  const fc = K_TO_FC[m[1]];
  return fc ? { k: m[1], fc } : null;
}
