/**
 * Title Case ala bahasa Indonesia.
 *
 * Aturan:
 * - Setiap kata di-Capitalize.
 * - Kata penghubung & preposisi pendek (di, ke, dari, dan, atau, yang, dst.)
 *   tetap lowercase, KECUALI kata pertama.
 * - Akronim umum (PT, CV, RT, RW, AC, dst.) di-uppercase penuh.
 * - Roman numeral (II, III, IV, ...) di-uppercase.
 * - Hyphenated word ("anak-anak") → setiap part di-Capitalize ("Anak-Anak").
 * - Numbers + non-letter prefix preserved (mis. "no.5", "RT.01").
 */

const LOWERCASE_WORDS = new Set([
  // preposisi
  "di",
  "ke",
  "dari",
  "pada",
  "untuk",
  "dengan",
  "oleh",
  "atas",
  "bawah",
  "tentang",
  "kepada",
  "bagi",
  "dalam",
  "antara",
  // konjungsi
  "dan",
  "atau",
  "serta",
  "tetapi",
  "namun",
  "lalu",
  "kemudian",
  "maupun",
  // partikel/penghubung
  "yang",
  "ini",
  "itu",
  "akan",
  "telah",
  "sudah",
]);

const UPPERCASE_WORDS = new Set([
  "pt",
  "cv",
  "ud",
  "pd",
  "rt",
  "rw",
  "rt.",
  "rw.",
  "ac",
  "pvc",
  "grc",
  "wpc",
  "rab",
  "boq",
  "lb",
  "lt",
  "kk",
  "spt",
  "spbu",
  "umkm",
  "smp",
  "sma",
  "sd",
  "smk",
  "tk",
  "paud",
  "uin",
  "iain",
]);

const ROMAN_NUMERAL_RE = /^[ivxlcdm]+$/i;

export function toTitleCaseId(input: string | null | undefined): string {
  if (!input) return "";
  const cleaned = input.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  return cleaned
    .split(" ")
    .map((word, idx) => formatWord(word, idx === 0))
    .join(" ");
}

function formatWord(word: string, isFirst: boolean): string {
  if (!word) return word;
  const lower = word.toLowerCase();

  // Akronim → all caps
  if (UPPERCASE_WORDS.has(lower)) return word.toUpperCase();

  // Roman numeral (≥ 2 char biar gak nge-uppercase "i" kosong)
  if (lower.length >= 2 && ROMAN_NUMERAL_RE.test(lower)) {
    return word.toUpperCase();
  }

  // Connector → lowercase (kecuali first word)
  if (!isFirst && LOWERCASE_WORDS.has(lower)) return lower;

  // Hyphenated → tiap part di-capitalize
  if (word.includes("-")) {
    return word
      .split("-")
      .map((part) => capitalizeFirstLetter(part.toLowerCase()))
      .join("-");
  }

  return capitalizeFirstLetter(lower);
}

/**
 * Capitalize huruf pertama yang valid (a-z). Kalau diawali angka/symbol,
 * cari letter pertama. Mis. "5km" → "5km", "no.5" → "No.5".
 */
function capitalizeFirstLetter(s: string): string {
  if (!s) return s;
  const match = s.match(/[a-zA-Z]/);
  if (!match || match.index === undefined) return s;
  return s.slice(0, match.index) + match[0].toUpperCase() + s.slice(match.index + 1);
}

/**
 * Handler buat onBlur: format value langsung di DOM.
 * Cocok buat uncontrolled <input> (defaultValue).
 */
export function titleCaseOnBlur(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
): void {
  const formatted = toTitleCaseId(e.currentTarget.value);
  if (formatted !== e.currentTarget.value) {
    e.currentTarget.value = formatted;
  }
}
