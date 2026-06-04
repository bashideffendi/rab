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

// Mutu beton karakteristik K (kg/cm², kubus) → f'c (MPa, silinder). Tiap K
// kasih nilai presisi (×0,083) PLUS mutu standar SE DJBK terdekat — data AHSP
// pakai f'c BULAT (7,5/10/15/17/20/25/30/35/40), bukan nilai presisi. Tanpa
// nilai bulat, "K-225" cuma cocok item ilustratif, bukan "f'c 20 MPa" riil.
const K_TO_FC: Record<string, string[]> = {
  "100": ["7,4", "7,5"],
  "125": ["9,8", "10"],
  "150": ["12,2", "12,5", "15"],
  "175": ["14,5", "15"],
  "200": ["16,9", "17"],
  "225": ["19,3", "20"],
  "250": ["21,7", "20", "25"],
  "275": ["24", "25"],
  "300": ["26,4", "25", "30"],
  "350": ["31,2", "30", "35"],
  "400": ["33,2", "35"],
  "450": ["37,4", "40"],
  "500": ["41,5", "45"],
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
  // Besi tulangan: AHSP nyimpen sbg "Penulangan ..." (mis. "Penulangan kolom,
  // balok, ring balk, sloof untuk BjTP"). Praktisi ngetik "pembesian" / "besi
  // beton" / "tulangan" → tanpa alias gak ketemu sama sekali.
  pembesian: ["penulangan"],
  penulangan: ["pembesian"],
  tulangan: ["penulangan", "pembesian"],
  // Varian ejaan umum yg beda sama nama katalog.
  saklar: ["sakelar"],
  sakelar: ["saklar"],
  closet: ["kloset"],
  kloset: ["closet"],
  wc: ["kloset", "closet"],
  plafon: ["plafond", "langit-langit"],
  plafond: ["plafon"],
};

/** Normalisasi K-grade jadi satu token "Kxxx" ("K-225", "K 225" → "K225"). */
function normalizeGrades(query: string): string {
  return query.replace(/\bK[-\s]?(\d{2,3})\b/gi, (_m, d) => `K${d}`);
}

// Frasa multi-kata → satu token, dijalanin SEBELUM tokenisasi. Perlu buat istilah
// yang kalau dipecah jadi token generik gak nyambung (mis. "besi beton" → token
// "besi"+"beton" gak ada yg ngarah ke "Penulangan").
const PHRASE_SYNONYMS: [RegExp, string][] = [
  [/\bbesi\s+beton\b/gi, "pembesian"],
  [/\bbaja\s+tulangan\b/gi, "pembesian"],
  [/\bbatu\s+bata\b/gi, "bata merah"],
];

function normalizePhrases(query: string): string {
  let q = query;
  for (const [re, rep] of PHRASE_SYNONYMS) q = q.replace(re, rep);
  return q;
}

/**
 * Pecah query jadi token; tiap token → daftar pola alias (string mentah, tanpa %).
 * Caller bikin pattern `%pola%` dan AND antar-token, OR antar-pola.
 */
export function expandQuery(query: string): string[][] {
  const normalized = normalizeGrades(normalizePhrases(query.trim()));
  const rawTokens = normalized.split(/\s+/).filter(Boolean);

  return rawTokens.map((tok) => {
    const patterns = new Set<string>([tok]);

    const grade = tok.match(/^K(\d{2,3})$/i);
    if (grade) {
      const k = grade[1];
      const fcs = K_TO_FC[k];
      if (fcs) {
        for (const fc of fcs) {
          patterns.add(fc); // "20" / "19,3"
          patterns.add(fc.replace(",", ".")); // "19.3"
        }
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
  const fcs = K_TO_FC[m[1]];
  return fcs ? { k: m[1], fc: fcs[0] } : null;
}
