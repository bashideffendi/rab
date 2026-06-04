/**
 * Parse angka harga/volume — SATU sumber kebenaran dipakai jalur FORM
 * (item-actions parseNum) DAN inline-edit (EditableCell di tabel) biar dua
 * jalur entri konsisten (dulu inline strict dot-only nolak ribuan id-ID yang
 * form terima). Terima format id-ID (koma=desimal, titik=ribuan) + format polos.
 * Return string canonical dot-decimal (≥0), atau null kalau invalid.
 *
 * Contoh: "1.250.000,50" → "1250000.50" · "1250,5" → "1250.5" · "3.2" → "3.2"
 *         "1.250" → "1250" (ribuan) · "Rp 350.000" → "350000" · "abc" → null
 */
export function parseNumStr(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  // Buang selain digit/titik/koma/minus. Minus DIPERTAHANKAN (bukan di-strip)
  // biar input negatif kebaca Number<0 → ditolak (null), bukan diam-diam jadi
  // positif (mis. "-5" harus null, jangan jadi 5).
  s = s.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",")) {
    // Ada koma → koma = desimal id-ID, titik = ribuan.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Titik berkelompok 3 tanpa koma → ribuan murni ("1.250.000" → 1250000).
    s = s.replace(/\./g, "");
  }
  // else: titik tunggal tetap desimal ("3.2" → 3.2)
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return s;
}
