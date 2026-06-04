/**
 * Stage Calculators — bundle multiple AHSP items per tahap konstruksi.
 *
 * RAB Pro pattern: 1 calculator screen → multiple line items output.
 * User input dimensi sekali (lahan/bangunan), dapet 4-8 line items siap-pakai.
 *
 * Difference dari single-AHSP calculators di volume-calculators.tsx:
 *  - Single: 1 form → 1 volume → 1 AHSP item to add
 *  - Stage:  1 form → multiple sub-items, each with own AHSP + volume
 */

import type { CalcInputDef } from "./volume-calculators";

// ── Schedule (tabel multi-baris) ────────────────────────────────────────────
// Sebagian stage (mis. kolom) realistis punya BANYAK tipe (K1, K2, Kp …) dengan
// dimensi/penulangan beda. Schedule = tabel; tiap baris 1 tipe. Beberapa output
// (beton/besi/bekisting) berbagi SATU tabel via `group` yang sama.
export type ScheduleColumnDef = {
  key: string;
  label: string;
  unit?: string;
  kind?: "text" | "number" | "select";
  default?: string | number;
  width?: string;
  options?: { value: number; label: string }[];
};

export type ScheduleDef = {
  /** Item dgn group sama berbagi 1 tabel rows. Mis. semua output kolom. */
  group: string;
  /** Label tabel (mis. "Skedul Kolom"). */
  title: string;
  hint?: string;
  columns: ScheduleColumnDef[];
};

/** 1 baris tabel. Nilai number disimpan number, tipe/nama disimpan string. */
export type ScheduleRow = Record<string, number | string>;

export type StageItemDef = {
  /** Unique key dalam stage (untuk React key + checkbox state) */
  key: string;
  /** Label yang tampil di UI sub-item card */
  label: string;
  /** Keyword untuk search AHSP (case-insensitive). Best match auto-picked.
   *  Boleh fungsi dari inputs (mis. mutu beton dinamis: K→f'c via expandQuery). */
  ahspKeyword: string | ((inputs: Record<string, number>) => string);
  /** Expected unit AHSP (mis. "m", "m2", "m3") — filter search results */
  ahspUnit: string;
  /** Whether checkbox checked by default */
  defaultEnabled: boolean;
  /**
   * Hide sub-item kalau condition gak met.
   * Mis. Direksikeet hanya tampil kalau luasDireksikeet > 0.
   */
  showIf?: (inputs: Record<string, number>) => boolean;
  /**
   * OPSIONAL. Kalau ada → item ini diisi via tabel multi-baris (schedule),
   * bukan input global. Item lain ber-`schedule.group` sama berbagi 1 tabel.
   */
  schedule?: ScheduleDef;
  /**
   * Compute volume + formula breakdown dari shared inputs.
   * `rows` = baris schedule kalau item pakai schedule (undefined utk item biasa;
   * 15 stage lama abaikan arg ke-2 ini).
   * Return null kalau gak applicable (akan di-skip).
   */
  computeVolume: (
    inputs: Record<string, number>,
    rows?: ScheduleRow[],
  ) => {
    volume: number;
    formula: string;
  } | null;
};

export type StageCalcDef = {
  type: string;
  label: string;
  description: string;
  /** Shared inputs untuk semua sub-items */
  inputs: CalcInputDef[];
  items: StageItemDef[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function n(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const x = parseFloat(v.replace(",", "."));
    return Number.isFinite(x) ? x : fallback;
  }
  return fallback;
}

function fmt(num: number, decimals = 2): string {
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/** Tabel diameter besi → berat per meter (kg/m) — standar AutoRAB.
 *  Formula: berat = 0.006165 × d² (d dalam mm, ρ baja 7850 kg/m³). */
const REBAR_WEIGHT: Record<number, number> = {
  6: 0.222,
  8: 0.395,
  10: 0.617,
  12: 0.888,
  13: 1.042,
  16: 1.578,
  19: 2.226,
  22: 2.984,
  25: 3.853,
};

function rebarWeight(dia: number): number {
  return REBAR_WEIGHT[dia] ?? 0.006165 * dia * dia;
}

// ── BBS (Bar Bending Schedule) helpers — SNI 2847:2019 ──────────────────────
// PENTING: kait & lewatan = panjang baja RIIL geometris (BUKAN waste). Koef
// AHSP pembesian (basis 10 kg) cuma memuat bendrat ~1,5% + susut potong, jadi
// menambah kait/lewatan ke panjang teoritis BUKAN double-count dengan AHSP.

/** Panjang ekor kait seismik 135° per ujung (m). Tabel 25.3.1: max(6db, 75mm). */
function hookTail135(diaMm: number): number {
  return Math.max(6 * diaMm, 75) / 1000;
}

/** Keliling potong 1 sengkang tertutup + 2 kait 135° (m) — pengganti konstanta
 *  "+0,1" lama. b,h,k dalam meter (k = selimut ke as sengkang). */
function stirrupPerimeter(
  b: number,
  h: number,
  k: number,
  diaMm: number,
): number {
  return 2 * (b - 2 * k + (h - 2 * k)) + 2 * hookTail135(diaMm);
}

/** Panjang besi stok pabrik (m) — di atas ini batang utama disambung lewatan. */
const STOCK_BAR_LENGTH = 12;

/** Panjang 1 sambungan lewatan tarik 40·db (m). SNI 2847:2019. */
function lapSplice(diaMm: number): number {
  return (40 * diaMm) / 1000;
}

/** Mutu beton (K-X) → keyword search AHSP. Pakai notasi "K{x}" supaya
 *  expandQuery di /api/ahsp/search nge-map ke f'c yang benar & cocok ke beton
 *  STRUKTURAL (token K/225/19,3 dst), bukan lean "f'c 10 MPa, agregat maks 19
 *  mm" — notasi "f'c 19" lama malah nyangkut ke "19 mm" agregat lean. */
function mutuBetonKeyword(k: number): string {
  return "beton K" + k;
}

// ── Schedule helpers (agregasi tabel multi-baris) ───────────────────────────
function rn(row: ScheduleRow, key: string, fallback = 0): number {
  return n(row[key], fallback);
}
function rs(row: ScheduleRow, key: string, fallback = ""): string {
  const v = row[key];
  return typeof v === "string" && v.trim() ? v : fallback;
}

/** Hitung 1 baris kolom → beton (m3) + label breakdown. */
function kolomRowBeton(row: ScheduleRow): { v: number; line: string } {
  const tag = rs(row, "tipe", "K?");
  const b1 = rn(row, "b1", 0.15);
  const b2 = rn(row, "b2", 0.15);
  const T = rn(row, "T", 4);
  const jml = rn(row, "jml", 1);
  const v = b1 * b2 * T * jml;
  return {
    v,
    line: `${tag} ${fmt(b1, 2)}×${fmt(b2, 2)}×${fmt(T, 2)}×${jml} = ${fmt(v, 3)} m³`,
  };
}

/** Hitung 1 baris kolom → pembesian (kg) + label. selimut & mutu dari global. */
function kolomRowBesi(
  row: ScheduleRow,
  selimut: number,
): { v: number; line: string } {
  const tag = rs(row, "tipe", "K?");
  const b1 = rn(row, "b1", 0.15);
  const b2 = rn(row, "b2", 0.15);
  const T = rn(row, "T", 4);
  const jml = rn(row, "jml", 1);
  const D1 = rn(row, "D1", 12);
  const n1 = rn(row, "n1", 4);
  const D3 = rn(row, "D3", 8);
  const R = rn(row, "R", 0.15);
  // Tulangan utama menerus + lewatan kalau tinggi > stok 12 m (jarang utk kolom).
  const samb = T > STOCK_BAR_LENGTH ? Math.floor(T / STOCK_BAR_LENGTH) : 0;
  const lUtama = (T * n1 + samb * lapSplice(D1) * n1) * jml;
  const wUtama = lUtama * rebarWeight(D1);
  const kelRing = stirrupPerimeter(b1, b2, selimut, D3);
  const jmlRing = (Math.ceil(T / R) + 1) * jml;
  const wRing = kelRing * jmlRing * rebarWeight(D3);
  const v = wUtama + wRing;
  return {
    v,
    line: `${tag}(×${jml}): utama ${n1}Ø${D1} ${fmt(wUtama, 1)}kg + begel Ø${D3}@${fmt(R * 100, 0)} ${fmt(wRing, 1)}kg = ${fmt(v, 1)} kg`,
  };
}

/** Hitung 1 baris kolom → bekisting (m2) + label. */
function kolomRowBekisting(row: ScheduleRow): { v: number; line: string } {
  const tag = rs(row, "tipe", "K?");
  const b1 = rn(row, "b1", 0.15);
  const b2 = rn(row, "b2", 0.15);
  const T = rn(row, "T", 4);
  const jml = rn(row, "jml", 1);
  const v = 2 * (b1 + b2) * T * jml;
  return {
    v,
    line: `${tag} 2×(${fmt(b1, 2)}+${fmt(b2, 2)})×${fmt(T, 2)}×${jml} = ${fmt(v, 2)} m²`,
  };
}

/** Generik: agregasi semua baris pakai fn per-baris → {volume, formula}. */
function aggRows(
  rows: ScheduleRow[] | undefined,
  fn: (r: ScheduleRow) => { v: number; line: string },
  unit: string,
): { volume: number; formula: string } | null {
  if (!rows || rows.length === 0) return null;
  let total = 0;
  const lines: string[] = [];
  for (const r of rows) {
    const { v, line } = fn(r);
    if (v > 0) {
      total += v;
      lines.push(line);
    }
  }
  if (total <= 0) return null;
  return {
    volume: total,
    formula: `${lines.join(" | ")} → Σ ${fmt(total, unit === "kg" ? 1 : 3)} ${unit}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1: PERSIAPAN
// ─────────────────────────────────────────────────────────────────────────────

const stagePersiapan: StageCalcDef = {
  type: "stage_persiapan",
  label: "Tahap Persiapan",
  description:
    "Pekerjaan persiapan lengkap: pembersihan, bouwplank, direksi keet, gudang bahan, steiger, pembongkaran existing, pengukuran. Input dimensi sekali, sub-items auto-hitung.",
  inputs: [
    // Dimensi utama
    {
      key: "P",
      label: "Panjang Bangunan",
      unit: "m",
      default: 8,
      hint: "Panjang struktur (tanpa offset)",
      group: "Dimensi Lahan & Bangunan",
    },
    {
      key: "L",
      label: "Lebar Bangunan",
      unit: "m",
      default: 6,
      hint: "Lebar struktur",
      group: "Dimensi Lahan & Bangunan",
    },
    {
      key: "offset",
      label: "Offset Bouwplank",
      unit: "m",
      default: 1,
      hint: "Jarak bouwplank ke pinggir struktur (standar 1 m)",
      group: "Dimensi Lahan & Bangunan",
    },
    {
      key: "luasLahan",
      label: "Luas Lahan Total (override)",
      unit: "m²",
      default: 0,
      hint: "0 = auto pakai dimensi bangunan + offset",
      group: "Dimensi Lahan & Bangunan",
    },
    // Bangunan sementara
    {
      key: "luasDireksikeet",
      label: "Luas Direksi Keet / Kantor",
      unit: "m²",
      default: 0,
      hint: "Kantor proyek + los kerja. 0 = skip. Default ~12-24 m²",
      group: "Bangunan Sementara",
    },
    {
      key: "luasGudangBahan",
      label: "Luas Gudang Bahan / Semen",
      unit: "m²",
      default: 0,
      hint: "Tempat simpan semen/material. 0 = skip. Default ~12 m²",
      group: "Bangunan Sementara",
    },
    {
      key: "papanNama",
      label: "Papan Nama Proyek",
      unit: "buah",
      default: 0,
      hint: "Default 1 untuk proyek pemerintah. 0 = skip.",
      group: "Bangunan Sementara",
    },
    // Steiger / scaffolding
    {
      key: "luasSteiger",
      label: "Luas Steiger / Scaffolding",
      unit: "m²",
      default: 0,
      hint: "Untuk proyek bertingkat. 0 = skip.",
      group: "Steiger & Pembongkaran",
    },
    // Pembongkaran (renovasi)
    {
      key: "volBongkarPasangan",
      label: "Vol. Bongkar Pasangan Batu/Bata",
      unit: "m³",
      default: 0,
      hint: "Tembok existing yang dibongkar. 0 = skip.",
      group: "Steiger & Pembongkaran",
    },
    {
      key: "luasBongkarAtap",
      label: "Luas Bongkar Atap",
      unit: "m²",
      default: 0,
      hint: "Atap existing yang dibongkar. 0 = skip.",
      group: "Steiger & Pembongkaran",
    },
    // Pengukuran
    {
      key: "luasPengukuran",
      label: "Luas Pengukuran Topografi",
      unit: "Ha",
      default: 0,
      hint: "0 = skip. Pengukuran biasanya untuk lahan > 0.1 Ha",
      group: "Steiger & Pembongkaran",
    },
  ],
  items: [
    {
      key: "pembersihan",
      label: "Pembersihan Lahan",
      ahspKeyword: "pembersihan permukaan",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.P);
        const L = n(i.L);
        const offset = n(i.offset, 1);
        const luasLahan = n(i.luasLahan);
        const v =
          luasLahan > 0
            ? luasLahan
            : (P + 2 * offset + 2) * (L + 2 * offset + 2);
        const formula =
          luasLahan > 0
            ? `${fmt(luasLahan, 2)} m² (input langsung)`
            : `(${fmt(P, 2)} + 2×${fmt(offset, 2)} + 2) × (${fmt(L, 2)} + 2×${fmt(offset, 2)} + 2) = ${fmt(v, 2)} m²`;
        return { volume: v, formula };
      },
    },
    {
      key: "bouwplank",
      label: "Bouwplank / Profil",
      ahspKeyword: "bouwplank",
      ahspUnit: "m",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.P);
        const L = n(i.L);
        const offset = n(i.offset, 1);
        const v = 2 * (P + 2 * offset + (L + 2 * offset));
        const formula = `2 × ((${fmt(P, 2)} + 2×${fmt(offset, 2)}) + (${fmt(L, 2)} + 2×${fmt(offset, 2)})) = ${fmt(v, 2)} m`;
        return { volume: v, formula };
      },
    },
    {
      key: "direksikeet",
      label: "Direksi Keet / Kantor Proyek",
      ahspKeyword: "direksi keet",
      ahspUnit: "m2",
      defaultEnabled: false,
      showIf: (i) => n(i.luasDireksikeet) > 0,
      computeVolume: (i) => {
        const v = n(i.luasDireksikeet);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m² (input langsung)` };
      },
    },
    {
      key: "gudangBahan",
      label: "Pembuatan Gudang Bahan / Semen",
      ahspKeyword: "kantor sementara gudang semen",
      ahspUnit: "m2",
      defaultEnabled: false,
      showIf: (i) => n(i.luasGudangBahan) > 0,
      computeVolume: (i) => {
        const v = n(i.luasGudangBahan);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m² (input langsung)` };
      },
    },
    {
      key: "papanNama",
      label: "Papan Nama Proyek",
      ahspKeyword: "papan nama",
      ahspUnit: "buah",
      defaultEnabled: false,
      showIf: (i) => n(i.papanNama) > 0,
      computeVolume: (i) => {
        const v = n(i.papanNama);
        if (v <= 0) return null;
        return {
          volume: v,
          formula: `${fmt(v, 0)} buah (input langsung)`,
        };
      },
    },
    {
      key: "steiger",
      label: "Steiger / Scaffolding",
      ahspKeyword: "steiger scaffolding",
      ahspUnit: "m2",
      defaultEnabled: false,
      showIf: (i) => n(i.luasSteiger) > 0,
      computeVolume: (i) => {
        const v = n(i.luasSteiger);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m² (input langsung)` };
      },
    },
    {
      key: "bongkarPasangan",
      label: "Pembongkaran Pasangan Batu/Bata",
      ahspKeyword: "bongkaran pasangan batu",
      ahspUnit: "m3",
      defaultEnabled: false,
      showIf: (i) => n(i.volBongkarPasangan) > 0,
      computeVolume: (i) => {
        const v = n(i.volBongkarPasangan);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 3)} m³ (input langsung)` };
      },
    },
    {
      key: "bongkarAtap",
      label: "Pembongkaran Atap Existing",
      ahspKeyword: "pembongkaran penutup atap",
      ahspUnit: "m2",
      defaultEnabled: false,
      showIf: (i) => n(i.luasBongkarAtap) > 0,
      computeVolume: (i) => {
        const v = n(i.luasBongkarAtap);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m² (input langsung)` };
      },
    },
    {
      key: "pengukuran",
      label: "Pengukuran Topografi",
      ahspKeyword: "pengukuran topografi",
      ahspUnit: "Ha",
      defaultEnabled: false,
      showIf: (i) => n(i.luasPengukuran) > 0,
      computeVolume: (i) => {
        const v = n(i.luasPengukuran);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 4)} Ha (input langsung)` };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: PONDASI
// ─────────────────────────────────────────────────────────────────────────────

const stagePondasi: StageCalcDef = {
  type: "stage_pondasi",
  label: "Tahap Pondasi",
  description:
    "Pondasi menerus / pasangan batu: galian + urugan pasir + lantai kerja + pasangan batu + urugan kembali. Per meter linear pondasi.",
  inputs: [
    {
      key: "panjangTotal",
      label: "Total Panjang Pondasi",
      unit: "m",
      default: 1,
      hint: "Total panjang pondasi menerus (bisa total semua jalur)",
      group: "Dimensi Pondasi",
    },
    {
      key: "lebarGalian",
      label: "Lebar Galian",
      unit: "m",
      default: 0.6,
      hint: "Lebar dasar galian (= lebar bawah pondasi)",
      group: "Dimensi Pondasi",
    },
    {
      key: "kedalaman",
      label: "Kedalaman Galian",
      unit: "m",
      default: 0.6,
      group: "Dimensi Pondasi",
    },
    {
      key: "lebarAtasGalian",
      label: "Lebar Atas Galian",
      unit: "m",
      default: 0.8,
      hint: "Lebar mulut galian di permukaan (≥ lebar dasar; samakan dgn lebar galian kalau dinding tegak lurus)",
      group: "Dimensi Pondasi",
    },
    {
      key: "lebarAtasPondasi",
      label: "Lebar Atas Pondasi",
      unit: "m",
      default: 0.25,
      hint: "Sisi atas trapesium pondasi (lebar bawah = lebar galian)",
      group: "Dimensi Pondasi",
    },
    {
      key: "tinggiPondasi",
      label: "Tinggi Pondasi Batu",
      unit: "m",
      default: 0.5,
      hint: "Biasanya = kedalaman atau lebih kecil sedikit",
      group: "Dimensi Pondasi",
    },
    {
      key: "tebalUruganPasir",
      label: "Tebal Urugan Pasir",
      unit: "m",
      default: 0.05,
      hint: "Lapis pasir bawah pondasi. 0 = skip.",
      group: "Spesifikasi",
    },
    {
      key: "tebalAanstamping",
      label: "Tebal Aanstamping",
      unit: "m",
      default: 0,
      hint: "Lapis batu kosong di atas pasir. 0 = skip.",
      group: "Spesifikasi",
    },
    {
      key: "tebalLantaiKerja",
      label: "Tebal Lantai Kerja Beton",
      unit: "m",
      default: 0,
      hint: "Beton tumbuk 1:3:5 dasar. 0 = skip.",
      group: "Spesifikasi",
    },
  ],
  items: [
    {
      key: "galian",
      label: "Galian Tanah Pondasi",
      ahspKeyword: "galian tanah biasa",
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.panjangTotal);
        const Lb = n(i.lebarGalian, 0.6);
        const La = n(i.lebarAtasGalian, Lb); // default lurus kalau tak diisi
        const T = n(i.kedalaman, 0.6);
        // Penampang galian = trapesium (dinding tegak/miring; lebar atas ≥ dasar)
        const v = ((La + Lb) / 2) * T * P;
        const formula = `((${fmt(La, 2)} + ${fmt(Lb, 2)})/2) × ${fmt(T, 2)} × ${fmt(P, 2)} = ${fmt(v, 3)} m³`;
        return { volume: v, formula };
      },
    },
    {
      key: "uruganPasir",
      label: "Urugan Pasir Bawah Pondasi",
      ahspKeyword: "urukan pasir",
      ahspUnit: "m3",
      defaultEnabled: true,
      showIf: (i) => n(i.tebalUruganPasir) > 0,
      computeVolume: (i) => {
        const P = n(i.panjangTotal);
        const L = n(i.lebarGalian, 0.6);
        const T = n(i.tebalUruganPasir, 0.05);
        if (T <= 0) return null;
        const v = P * L * T;
        const formula = `${fmt(P, 2)} × ${fmt(L, 2)} × ${fmt(T, 3)} = ${fmt(v, 3)} m³`;
        return { volume: v, formula };
      },
    },
    {
      key: "aanstamping",
      label: "Aanstamping (Batu Kosong)",
      ahspKeyword: "aanstamping",
      ahspUnit: "m3",
      defaultEnabled: false,
      showIf: (i) => n(i.tebalAanstamping) > 0,
      computeVolume: (i) => {
        const P = n(i.panjangTotal);
        const L = n(i.lebarGalian, 0.6);
        const T = n(i.tebalAanstamping);
        if (T <= 0) return null;
        const v = P * L * T;
        const formula = `${fmt(P, 2)} × ${fmt(L, 2)} × ${fmt(T, 3)} = ${fmt(v, 3)} m³`;
        return { volume: v, formula };
      },
    },
    {
      key: "lantaiKerja",
      label: "Lantai Kerja Beton (Beton Tumbuk)",
      ahspKeyword: "beton mutu rendah",
      ahspUnit: "m3",
      defaultEnabled: false,
      showIf: (i) => n(i.tebalLantaiKerja) > 0,
      computeVolume: (i) => {
        const P = n(i.panjangTotal);
        const L = n(i.lebarGalian, 0.6);
        const T = n(i.tebalLantaiKerja);
        if (T <= 0) return null;
        const v = P * L * T;
        const formula = `${fmt(P, 2)} × ${fmt(L, 2)} × ${fmt(T, 3)} = ${fmt(v, 3)} m³`;
        return { volume: v, formula };
      },
    },
    {
      key: "pondasiBatuBelah",
      label: "Pasangan Pondasi Batu Belah 1:5",
      ahspKeyword: "fondasi batu belah",
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.panjangTotal);
        const a = n(i.lebarAtasPondasi, 0.25);
        const b = n(i.lebarGalian, 0.6);
        const T = n(i.tinggiPondasi, 0.5);
        // Volume trapesium: ((a+b)/2) × T × P
        const v = ((a + b) / 2) * T * P;
        const formula = `((${fmt(a, 2)} + ${fmt(b, 2)})/2) × ${fmt(T, 2)} × ${fmt(P, 2)} = ${fmt(v, 3)} m³`;
        return { volume: v, formula };
      },
    },
    {
      key: "uruganKembali",
      label: "Urugan Kembali Bekas Galian",
      ahspKeyword: "urukan kembali",
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.panjangTotal);
        const Lb = n(i.lebarGalian, 0.6);
        const La = n(i.lebarAtasGalian, Lb);
        const kdl = n(i.kedalaman, 0.6);
        const vGalian = ((La + Lb) / 2) * kdl * P;
        // Urugan kembali = galian − semua yang mengisi lubang (anti double-count)
        const aTop = n(i.lebarAtasPondasi, 0.25);
        const tPon = n(i.tinggiPondasi, 0.5);
        const vPondasi = ((aTop + Lb) / 2) * tPon * P;
        const vPasir = P * Lb * n(i.tebalUruganPasir, 0);
        const vAan = P * Lb * n(i.tebalAanstamping, 0);
        const vLantai = P * Lb * n(i.tebalLantaiKerja, 0);
        const vIsian = vPondasi + vPasir + vAan + vLantai;
        const v = Math.max(0, vGalian - vIsian);
        const formula = `${fmt(vGalian, 3)} galian − ${fmt(vIsian, 3)} isian = ${fmt(v, 3)} m³`;
        return { volume: v, formula };
      },
    },
    {
      key: "buangTanah",
      label: "Buang/Angkut Tanah Keluar",
      ahspKeyword: "mengangkut tanah",
      ahspUnit: "m3",
      defaultEnabled: false,
      computeVolume: (i) => {
        const P = n(i.panjangTotal);
        const Lb = n(i.lebarGalian, 0.6);
        const aTop = n(i.lebarAtasPondasi, 0.25);
        const tPon = n(i.tinggiPondasi, 0.5);
        const vPondasi = ((aTop + Lb) / 2) * tPon * P;
        const vPasir = P * Lb * n(i.tebalUruganPasir, 0);
        const vAan = P * Lb * n(i.tebalAanstamping, 0);
        const vLantai = P * Lb * n(i.tebalLantaiKerja, 0);
        // Tanah yg keluar = volume terdesak struktur (tak bisa diurug balik),
        // × faktor gembur 1,2 (tanah lepas mengembang saat diangkut).
        const vIsian = vPondasi + vPasir + vAan + vLantai;
        const v = vIsian * 1.2;
        if (v <= 0) return null;
        return {
          volume: v,
          formula: `${fmt(vIsian, 3)} terdesak × 1,2 gembur = ${fmt(v, 3)} m³`,
        };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3: BETON SLOOF (mini-stage = 3 outputs: beton + tulangan + bekisting)
// ─────────────────────────────────────────────────────────────────────────────

const stageBetonSloof: StageCalcDef = {
  type: "stage_beton_sloof",
  label: "Beton Sloof (3 items)",
  description:
    "Sloof = balok bawah pondasi. Pembesian dipisah: utama (atas+bawah) + ring/begel + kawat ikat. RAB Pro level.",
  inputs: [
    {
      key: "Lsloof",
      label: "Lebar Sloof (b)",
      unit: "m",
      default: 0.15,
      group: "Dimensi Sloof",
    },
    {
      key: "Tsloof",
      label: "Tinggi Sloof (h)",
      unit: "m",
      default: 0.2,
      group: "Dimensi Sloof",
    },
    {
      key: "Ptotal",
      label: "Total Panjang Sloof",
      unit: "m",
      default: 30,
      hint: "Total seluruh jalur sloof",
      group: "Dimensi Sloof",
    },
    {
      key: "selimut",
      label: "Selimut Beton (k)",
      unit: "m",
      default: 0.025,
      hint: "Default 2.5 cm = 0.025 m",
      group: "Dimensi Sloof",
    },
    {
      key: "mutuBeton",
      label: "Mutu Beton",
      unit: "K",
      default: 225,
      group: "Spesifikasi Beton",
      options: [
        { value: 175, label: "K-175 (fc 14.5)" },
        { value: 225, label: "K-225 (fc 19.3)" },
        { value: 275, label: "K-275 (fc 22.5)" },
      ],
    },
    {
      key: "D1",
      label: "Ø Besi Utama (D1)",
      unit: "mm",
      default: 12,
      group: "Besi Utama",
      options: [
        { value: 10, label: "Ø10 mm" },
        { value: 12, label: "Ø12 mm" },
        { value: 13, label: "Ø13 mm" },
        { value: 16, label: "Ø16 mm" },
      ],
    },
    {
      key: "n1",
      label: "Jumlah Tulangan Utama (n1)",
      unit: "btg",
      default: 4,
      hint: "Total atas + bawah (biasanya 4-6)",
      group: "Besi Utama",
    },
    {
      key: "D3",
      label: "Ø Ring/Begel (D3)",
      unit: "mm",
      default: 8,
      group: "Sengkang / Ring",
      options: [
        { value: 6, label: "Ø6 mm" },
        { value: 8, label: "Ø8 mm" },
        { value: 10, label: "Ø10 mm" },
      ],
    },
    {
      key: "R",
      label: "Jarak Ring (R)",
      unit: "m",
      default: 0.15,
      group: "Sengkang / Ring",
    },
  ],
  items: [
    {
      key: "betonSloof",
      label: "Beton Sloof",
      ahspKeyword: (i) => mutuBetonKeyword(n(i.mutuBeton, 225)),
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const L = n(i.Lsloof);
        const T = n(i.Tsloof);
        const P = n(i.Ptotal);
        const v = L * T * P;
        return {
          volume: v,
          formula: `${fmt(L, 3)} × ${fmt(T, 3)} × ${fmt(P, 2)} = ${fmt(v, 3)} m³`,
        };
      },
    },
    {
      key: "penulanganSloof",
      label: "Penulangan Sloof (Besi + Kawat)",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: true,
      computeVolume: (i) => {
        const L = n(i.Lsloof);
        const T = n(i.Tsloof);
        const P = n(i.Ptotal);
        const k = n(i.selimut, 0.025);
        const D1 = n(i.D1, 12);
        const n1 = n(i.n1, 4);
        const D3 = n(i.D3, 8);
        const R = n(i.R, 0.15);

        // Besi utama
        // Lewatan 40·db utk batang menerus > 12 m (panjang stok pabrik).
        const sambungan =
          P > STOCK_BAR_LENGTH ? Math.floor(P / STOCK_BAR_LENGTH) : 0;
        const lLewatan = sambungan * lapSplice(D1) * n1;
        const lUtama = P * n1 + lLewatan;
        const wUtama = lUtama * rebarWeight(D1);
        // Ring/begel
        const kelRing = stirrupPerimeter(L, T, k, D3);
        const jmlRing = Math.ceil(P / R) + 1;
        const lRing = kelRing * jmlRing;
        const wRing = lRing * rebarWeight(D3);
        // Kawat ikat TIDAK ditambah ke volume: AHSP pembesian PUPR sudah
        // memuat bendrat (~0,15 kg/10 kg besi) + waste → +1% = double-count.
        const wBesi = wUtama + wRing;

        const formula = [
          `Utama Ø${D1} ${n1} btg×${fmt(P, 2)}m${lLewatan > 0 ? ` +lewatan ${fmt(lLewatan, 2)}m` : ""}: ${fmt(lUtama, 2)} m → ${fmt(wUtama, 2)} kg`,
          `Ring/Begel (Ø${D3} jarak ${fmt(R * 100, 0)} cm, ${jmlRing} buah): ${fmt(lRing, 2)} m → ${fmt(wRing, 2)} kg`,
          `TOTAL besi: ${fmt(wBesi, 2)} kg (kawat ikat sudah termasuk AHSP pembesian)`,
        ].join(" | ");

        return { volume: wBesi, formula };
      },
    },
    {
      key: "bekistingSloof",
      label: "Bekisting Sloof",
      ahspKeyword: "bekisting untuk sloof",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const L = n(i.Lsloof);
        const T = n(i.Tsloof);
        const P = n(i.Ptotal);
        const v = (2 * T + L) * P;
        return {
          volume: v,
          formula: `(2 × ${fmt(T, 3)} + ${fmt(L, 3)}) × ${fmt(P, 2)} = ${fmt(v, 2)} m²`,
        };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4: BETON KOLOM — RAB Pro level detail
// ─────────────────────────────────────────────────────────────────────────────
//
// Outputs 3 items utama (Beton + Pembesian + Bekisting), TAPI Pembesian
// dihitung dari 4 komponen terpisah (utama / support / ring / kawat ikat),
// kayak AutoRAB Pro. Formula breakdown visible di volume_formula tiap item.

const stageBetonKolom: StageCalcDef = {
  type: "stage_beton_kolom",
  label: "Beton Kolom (3 items)",
  description:
    "Kolom beton bertulang dengan tulangan utama + support + ring/begel terpisah. Pembesian kg dihitung detail per komponen + kawat ikat. RAB Pro level.",
  inputs: [
    // Dimensi
    {
      key: "Lx",
      label: "Lebar 1 (b1)",
      unit: "m",
      default: 0.15,
      hint: "Sisi X penampang. Default 15 cm = 0.15 m",
      group: "Dimensi Kolom",
    },
    {
      key: "Ly",
      label: "Lebar 2 (b2)",
      unit: "m",
      default: 0.15,
      hint: "Sisi Y penampang. Sama Lx kalau persegi",
      group: "Dimensi Kolom",
    },
    {
      key: "Tkolom",
      label: "Tinggi Kolom",
      unit: "m",
      default: 4.5,
      group: "Dimensi Kolom",
    },
    {
      key: "nKolom",
      label: "Jumlah Kolom",
      unit: "buah",
      default: 3,
      group: "Dimensi Kolom",
    },
    {
      key: "selimut",
      label: "Selimut Beton (k)",
      unit: "m",
      default: 0.02,
      hint: "Tebal kulit beton dari muka tulangan ke luar. Default 2 cm = 0.02 m",
      group: "Dimensi Kolom",
    },
    // Beton spec
    {
      key: "mutuBeton",
      label: "Mutu Beton",
      unit: "K",
      default: 225,
      group: "Spesifikasi Beton",
      options: [
        { value: 175, label: "K-175 (fc 14.5)" },
        { value: 225, label: "K-225 (fc 19.3)" },
        { value: 275, label: "K-275 (fc 22.5)" },
        { value: 300, label: "K-300 (fc 24.9)" },
      ],
    },
    // Besi Utama
    {
      key: "D1",
      label: "Ø Besi Utama (D1)",
      unit: "mm",
      default: 10,
      hint: "Tulangan di tiap sudut",
      group: "Besi Utama",
      options: [
        { value: 8, label: "Ø8 mm" },
        { value: 10, label: "Ø10 mm" },
        { value: 12, label: "Ø12 mm" },
        { value: 13, label: "Ø13 mm" },
        { value: 16, label: "Ø16 mm" },
        { value: 19, label: "Ø19 mm" },
      ],
    },
    {
      key: "n1",
      label: "Jumlah Besi Utama (n1)",
      unit: "btg",
      default: 4,
      hint: "Min 4 (1 di tiap sudut)",
      group: "Besi Utama",
    },
    // Besi Support (intermediate)
    {
      key: "D2",
      label: "Ø Besi Support (D2)",
      unit: "mm",
      default: 10,
      hint: "Tulangan tambahan di tengah sisi (intermediate). Default sama Utama.",
      group: "Besi Support",
      options: [
        { value: 8, label: "Ø8 mm" },
        { value: 10, label: "Ø10 mm" },
        { value: 12, label: "Ø12 mm" },
      ],
    },
    {
      key: "n2",
      label: "Jumlah Besi Support (n2)",
      unit: "btg",
      default: 0,
      hint: "0 = gak pakai. Pakai untuk kolom besar (>30 cm).",
      group: "Besi Support",
    },
    // Besi Ring/Begel
    {
      key: "D3",
      label: "Ø Besi Ring/Begel (D3)",
      unit: "mm",
      default: 8,
      group: "Sengkang / Ring",
      options: [
        { value: 6, label: "Ø6 mm" },
        { value: 8, label: "Ø8 mm" },
        { value: 10, label: "Ø10 mm" },
      ],
    },
    {
      key: "R",
      label: "Jarak Ring (R)",
      unit: "m",
      default: 0.15,
      hint: "Standar 10–20 cm. Daerah tumpuan lebih rapat.",
      group: "Sengkang / Ring",
    },
    // Kawat ikat
    {
      key: "Kb",
      label: "Ø Kawat Beton (Kb)",
      unit: "mm",
      default: 1.6,
      hint: "Default 1.6 mm",
      group: "Kawat Ikat",
    },
    {
      key: "Lkawat",
      label: "Panjang Kawat per Ikat",
      unit: "m",
      default: 0.3,
      hint: "Default 30 cm",
      group: "Kawat Ikat",
    },
  ],
  items: [
    {
      key: "betonKolom",
      label: "Beton Kolom",
      ahspKeyword: (i) => mutuBetonKeyword(n(i.mutuBeton, 225)),
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const Lx = n(i.Lx);
        const Ly = n(i.Ly);
        const T = n(i.Tkolom);
        const nk = n(i.nKolom, 1);
        const v = Lx * Ly * T * nk;
        return {
          volume: v,
          formula: `${fmt(Lx, 3)} × ${fmt(Ly, 3)} × ${fmt(T, 2)} × ${fmt(nk, 0)} = ${fmt(v, 3)} m³`,
        };
      },
    },
    {
      key: "penulanganKolom",
      label: "Penulangan Kolom (Besi + Kawat)",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: true,
      computeVolume: (i) => {
        const Lx = n(i.Lx);
        const Ly = n(i.Ly);
        const T = n(i.Tkolom);
        const nk = n(i.nKolom, 1);
        const k = n(i.selimut, 0.02);
        const D1 = n(i.D1, 10);
        const n1 = n(i.n1, 4);
        const D2 = n(i.D2, 10);
        const n2 = n(i.n2, 0);
        const D3 = n(i.D3, 8);
        const R = n(i.R, 0.15);

        // Panjang besi utama (m): tinggi × jumlah × kolom
        const lUtama = T * n1 * nk;
        const wUtama = lUtama * rebarWeight(D1);

        // Panjang besi support (m): sama formula, tapi pakai n2
        const lSupport = T * n2 * nk;
        const wSupport = lSupport * rebarWeight(D2);

        // Panjang besi ring (m):
        //   Keliling 1 ring = inti + 2 kait 135° (SNI 2847:2019), bukan +0,1.
        const kelRing = stirrupPerimeter(Lx, Ly, k, D3);
        const jmlRingPerKolom = Math.ceil(T / R) + 1;
        const lRing = kelRing * jmlRingPerKolom * nk;
        const wRing = lRing * rebarWeight(D3);

        // Kawat ikat TIDAK ditambah ke volume: AHSP pembesian sudah memuat
        // bendrat + waste → +1% = double-count.
        const wBesi = wUtama + wSupport + wRing;

        const formula = [
          `Utama (Ø${D1} × ${n1} btg × ${fmt(T, 2)} m × ${nk}): ${fmt(lUtama, 2)} m → ${fmt(wUtama, 2)} kg`,
          n2 > 0
            ? `Support (Ø${D2} × ${n2} btg × ${fmt(T, 2)} × ${nk}): ${fmt(lSupport, 2)} m → ${fmt(wSupport, 2)} kg`
            : "",
          `Ring/Begel (Ø${D3} jarak ${fmt(R * 100, 0)} cm, ${jmlRingPerKolom} buah/kolom × ${nk}): ${fmt(lRing, 2)} m → ${fmt(wRing, 2)} kg`,
          `TOTAL besi: ${fmt(wBesi, 2)} kg (kawat ikat sudah termasuk AHSP)`,
        ]
          .filter(Boolean)
          .join(" | ");

        return { volume: wBesi, formula };
      },
    },
    {
      key: "bekistingKolom",
      label: "Bekisting Kolom",
      ahspKeyword: "bekisting untuk kolom",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const Lx = n(i.Lx);
        const Ly = n(i.Ly);
        const T = n(i.Tkolom);
        const nk = n(i.nKolom, 1);
        const v = 2 * (Lx + Ly) * T * nk;
        return {
          volume: v,
          formula: `2 × (${fmt(Lx, 3)} + ${fmt(Ly, 3)}) × ${fmt(T, 2)} × ${fmt(nk, 0)} = ${fmt(v, 2)} m²`,
        };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 5: BETON BALOK (3 outputs)
// ─────────────────────────────────────────────────────────────────────────────

const stageBetonBalok: StageCalcDef = {
  type: "stage_beton_balok",
  label: "Beton Balok (3 items)",
  description:
    "Balok beton bertulang (atas/lantai). Pembesian dipisah: utama (atas+bawah) + support + ring/begel + kawat ikat. RAB Pro level.",
  inputs: [
    {
      key: "Lbalok",
      label: "Lebar Balok (b)",
      unit: "m",
      default: 0.2,
      group: "Dimensi Balok",
    },
    {
      key: "Tbalok",
      label: "Tinggi Balok (h)",
      unit: "m",
      default: 0.4,
      group: "Dimensi Balok",
    },
    {
      key: "Ptotal",
      label: "Total Panjang Balok",
      unit: "m",
      default: 50,
      group: "Dimensi Balok",
    },
    {
      key: "selimut",
      label: "Selimut Beton (k)",
      unit: "m",
      default: 0.025,
      group: "Dimensi Balok",
    },
    {
      key: "mutuBeton",
      label: "Mutu Beton",
      unit: "K",
      default: 225,
      group: "Spesifikasi Beton",
      options: [
        { value: 175, label: "K-175" },
        { value: 225, label: "K-225" },
        { value: 275, label: "K-275" },
      ],
    },
    {
      key: "D1",
      label: "Ø Besi Utama (D1)",
      unit: "mm",
      default: 13,
      group: "Besi Utama",
      options: [
        { value: 10, label: "Ø10 mm" },
        { value: 12, label: "Ø12 mm" },
        { value: 13, label: "Ø13 mm" },
        { value: 16, label: "Ø16 mm" },
        { value: 19, label: "Ø19 mm" },
      ],
    },
    {
      key: "n1",
      label: "Jumlah Tulangan Utama",
      unit: "btg",
      default: 6,
      hint: "Atas + bawah (4-8)",
      group: "Besi Utama",
    },
    {
      key: "D2",
      label: "Ø Besi Support (D2)",
      unit: "mm",
      default: 10,
      group: "Besi Support",
      options: [
        { value: 8, label: "Ø8 mm" },
        { value: 10, label: "Ø10 mm" },
        { value: 12, label: "Ø12 mm" },
      ],
    },
    {
      key: "n2",
      label: "Jumlah Besi Support",
      unit: "btg",
      default: 0,
      hint: "0 = skip. Untuk balok besar/panjang.",
      group: "Besi Support",
    },
    {
      key: "D3",
      label: "Ø Ring/Begel (D3)",
      unit: "mm",
      default: 8,
      group: "Sengkang / Ring",
      options: [
        { value: 8, label: "Ø8 mm" },
        { value: 10, label: "Ø10 mm" },
      ],
    },
    {
      key: "R",
      label: "Jarak Ring (R)",
      unit: "m",
      default: 0.15,
      group: "Sengkang / Ring",
    },
  ],
  items: [
    {
      key: "betonBalok",
      label: "Beton Balok",
      ahspKeyword: (i) => mutuBetonKeyword(n(i.mutuBeton, 225)),
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const L = n(i.Lbalok);
        const T = n(i.Tbalok);
        const P = n(i.Ptotal);
        const v = L * T * P;
        return {
          volume: v,
          formula: `${fmt(L, 3)} × ${fmt(T, 3)} × ${fmt(P, 2)} = ${fmt(v, 3)} m³`,
        };
      },
    },
    {
      key: "penulanganBalok",
      label: "Penulangan Balok (Besi + Kawat)",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: true,
      computeVolume: (i) => {
        const L = n(i.Lbalok);
        const T = n(i.Tbalok);
        const P = n(i.Ptotal);
        const k = n(i.selimut, 0.025);
        const D1 = n(i.D1, 13);
        const n1 = n(i.n1, 6);
        const D2 = n(i.D2, 10);
        const n2 = n(i.n2, 0);
        const D3 = n(i.D3, 8);
        const R = n(i.R, 0.15);

        // Lewatan 40·db utk batang menerus > 12 m (panjang stok pabrik).
        const sambungan =
          P > STOCK_BAR_LENGTH ? Math.floor(P / STOCK_BAR_LENGTH) : 0;
        const lLewatan = sambungan * lapSplice(D1) * n1;
        const lUtama = P * n1 + lLewatan;
        const wUtama = lUtama * rebarWeight(D1);
        const lSupport = P * n2 + sambungan * lapSplice(D2) * n2;
        const wSupport = lSupport * rebarWeight(D2);
        const kelRing = stirrupPerimeter(L, T, k, D3);
        const jmlRing = Math.ceil(P / R) + 1;
        const lRing = kelRing * jmlRing;
        const wRing = lRing * rebarWeight(D3);
        const wBesi = wUtama + wSupport + wRing;
        // Kawat ikat sudah termasuk AHSP pembesian → tidak ditambah (anti double-count).

        const formula = [
          `Utama Ø${D1} ${n1} btg×${fmt(P, 2)}m${lLewatan > 0 ? ` +lewatan ${fmt(lLewatan, 2)}m` : ""}: ${fmt(lUtama, 2)} m → ${fmt(wUtama, 2)} kg`,
          n2 > 0
            ? `Support (Ø${D2} × ${n2} btg × ${fmt(P, 2)}): ${fmt(lSupport, 2)} m → ${fmt(wSupport, 2)} kg`
            : "",
          `Ring/Begel (Ø${D3} jarak ${fmt(R * 100, 0)} cm, ${jmlRing} bh): ${fmt(lRing, 2)} m → ${fmt(wRing, 2)} kg`,
          `TOTAL besi: ${fmt(wBesi, 2)} kg (kawat ikat sudah termasuk AHSP)`,
        ]
          .filter(Boolean)
          .join(" | ");

        return { volume: wBesi, formula };
      },
    },
    {
      key: "bekistingBalok",
      label: "Bekisting Balok",
      ahspKeyword: "bekisting untuk balok",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const L = n(i.Lbalok);
        const T = n(i.Tbalok);
        const P = n(i.Ptotal);
        const v = (2 * T + L) * P;
        return {
          volume: v,
          formula: `(2 × ${fmt(T, 3)} + ${fmt(L, 3)}) × ${fmt(P, 2)} = ${fmt(v, 2)} m²`,
        };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 6: BETON PLAT LANTAI / DAK (3 outputs)
// ─────────────────────────────────────────────────────────────────────────────

const stageBetonPlat: StageCalcDef = {
  type: "stage_beton_plat",
  label: "Beton Plat Lantai / Dak (3 items)",
  description:
    "Plat lantai/dak beton dengan tulangan 2 lapis (atas-bawah).",
  inputs: [
    {
      key: "Pplat",
      label: "Panjang Plat",
      unit: "m",
      default: 6,
      group: "Dimensi Plat",
    },
    {
      key: "Lplat",
      label: "Lebar Plat",
      unit: "m",
      default: 4,
      group: "Dimensi Plat",
    },
    {
      key: "Tplat",
      label: "Tebal Plat",
      unit: "m",
      default: 0.12,
      hint: "Standar 10-15 cm = 0.10-0.15 m",
      group: "Dimensi Plat",
    },
    {
      key: "mutuBeton",
      label: "Mutu Beton",
      unit: "K",
      default: 225,
      group: "Spesifikasi Beton",
      options: [
        { value: 175, label: "K-175" },
        { value: 225, label: "K-225" },
        { value: 275, label: "K-275" },
      ],
    },
    {
      key: "diaTulangan",
      label: "Ø Tulangan",
      unit: "mm",
      default: 10,
      group: "Tulangan",
      options: [
        { value: 8, label: "Ø8 mm" },
        { value: 10, label: "Ø10 mm" },
        { value: 12, label: "Ø12 mm" },
      ],
    },
    {
      key: "jarakTulangan",
      label: "Jarak Tulangan",
      unit: "m",
      default: 0.15,
      hint: "Standar 15 cm. Lebih rapat = lebih kuat.",
      group: "Tulangan",
    },
    {
      key: "lapis",
      label: "Jumlah Lapis Tulangan",
      unit: "lapis",
      default: 2,
      hint: "1 lapis (rabat sederhana) atau 2 lapis (struktur)",
      group: "Tulangan",
      options: [
        { value: 1, label: "1 lapis" },
        { value: 2, label: "2 lapis (atas+bawah)" },
      ],
    },
  ],
  items: [
    {
      key: "betonPlat",
      label: "Beton Plat",
      ahspKeyword: (i) => mutuBetonKeyword(n(i.mutuBeton, 225)),
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Pplat);
        const L = n(i.Lplat);
        const T = n(i.Tplat);
        const v = P * L * T;
        return {
          volume: v,
          formula: `${fmt(P, 2)} × ${fmt(L, 2)} × ${fmt(T, 3)} = ${fmt(v, 3)} m³`,
        };
      },
    },
    {
      key: "penulanganPlat",
      label: "Penulangan Plat (Besi)",
      ahspKeyword: "penulangan slab",
      ahspUnit: "kg",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Pplat);
        const L = n(i.Lplat);
        const dia = n(i.diaTulangan, 10);
        const jrk = n(i.jarakTulangan, 0.15);
        const lapis = n(i.lapis, 2);

        const wPerM = REBAR_WEIGHT[dia] ?? 0.617;
        // Tulangan 2 arah (X dan Y), per lapis:
        //   arah X: jumlah = ceil(L / jrk) + 1, panjang = P
        //   arah Y: jumlah = ceil(P / jrk) + 1, panjang = L
        const nX = Math.ceil(L / jrk) + 1;
        const nY = Math.ceil(P / jrk) + 1;
        const panjangPerLapis = nX * P + nY * L;
        const totalPanjang = panjangPerLapis * lapis;
        const total = totalPanjang * wPerM;
        return {
          volume: total,
          formula: `${nX} bar × ${fmt(P, 2)} + ${nY} bar × ${fmt(L, 2)}, ${lapis} lapis × ${fmt(wPerM, 3)} kg/m = ${fmt(total, 2)} kg`,
        };
      },
    },
    {
      key: "bekistingPlat",
      label: "Bekisting Plat",
      ahspKeyword: "bekisting untuk plat lantai",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Pplat);
        const L = n(i.Lplat);
        const v = P * L;
        return {
          volume: v,
          formula: `${fmt(P, 2)} × ${fmt(L, 2)} = ${fmt(v, 2)} m²`,
        };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 7: PASANGAN & PLESTER (Dinding + Plester + Acian + Cat)
// ─────────────────────────────────────────────────────────────────────────────

const stagePasangan: StageCalcDef = {
  type: "stage_pasangan",
  label: "Pasangan & Plester (4 items)",
  description:
    "Dinding bata, plesteran, acian, dan pengecatan. Bukaan (pintu/jendela) dikurangi otomatis.",
  inputs: [
    {
      key: "Pdinding",
      label: "Total Panjang Dinding",
      unit: "m",
      default: 30,
      hint: "Total seluruh dinding",
      group: "Dimensi Dinding",
    },
    {
      key: "Tdinding",
      label: "Tinggi Dinding",
      unit: "m",
      default: 3,
      group: "Dimensi Dinding",
    },
    {
      key: "jenisBata",
      label: "Jenis Bata",
      unit: "",
      default: 1,
      group: "Spesifikasi",
      options: [
        { value: 1, label: "Bata Merah 1/2 (1:5)" },
        { value: 2, label: "Bata Hebel 7.5cm" },
        { value: 3, label: "Bata Hebel 10cm" },
      ],
    },
    {
      key: "jumlahPintu",
      label: "Jumlah Pintu",
      unit: "buah",
      default: 5,
      group: "Bukaan",
    },
    {
      key: "luasPintu",
      label: "Luas per Pintu",
      unit: "m²",
      default: 1.8,
      hint: "Default 0.9 × 2.0 = 1.8 m²",
      group: "Bukaan",
    },
    {
      key: "jumlahJendela",
      label: "Jumlah Jendela",
      unit: "buah",
      default: 6,
      group: "Bukaan",
    },
    {
      key: "luasJendela",
      label: "Luas per Jendela",
      unit: "m²",
      default: 1.2,
      group: "Bukaan",
    },
  ],
  items: [
    {
      key: "pasangan",
      label: "Pasangan Dinding Bata",
      ahspKeyword: (i) => {
        // jenisBata: 1=bata merah, 2=hebel 7,5cm, 3=hebel 10cm. Dulu keyword
        // statis → hebel keliru diharga bata merah. Sekarang ikut pilihan.
        const jb = n(i.jenisBata, 1);
        if (jb === 2) return "pemasangan dinding bata ringan 7,5";
        if (jb === 3) return "pemasangan dinding bata ringan 10";
        return "pemasangan dinding bata merah";
      },
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Pdinding);
        const T = n(i.Tdinding);
        const bukaan =
          n(i.jumlahPintu) * n(i.luasPintu, 1.8) +
          n(i.jumlahJendela) * n(i.luasJendela, 1.2);
        const v = Math.max(0, P * T - bukaan);
        return {
          volume: v,
          formula: `(${fmt(P, 2)} × ${fmt(T, 2)}) − ${fmt(bukaan, 2)} = ${fmt(v, 2)} m²`,
        };
      },
    },
    {
      key: "plester",
      label: "Plesteran (2 Sisi)",
      ahspKeyword: "plesteran 1sp 4pp tebal 15",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Pdinding);
        const T = n(i.Tdinding);
        const bukaan =
          n(i.jumlahPintu) * n(i.luasPintu, 1.8) +
          n(i.jumlahJendela) * n(i.luasJendela, 1.2);
        const luasBersih = Math.max(0, P * T - bukaan);
        const v = luasBersih * 2;
        return {
          volume: v,
          formula: `(${fmt(luasBersih, 2)} m² bersih) × 2 sisi = ${fmt(v, 2)} m²`,
        };
      },
    },
    {
      key: "acian",
      label: "Acian (2 Sisi)",
      ahspKeyword: "acian",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Pdinding);
        const T = n(i.Tdinding);
        const bukaan =
          n(i.jumlahPintu) * n(i.luasPintu, 1.8) +
          n(i.jumlahJendela) * n(i.luasJendela, 1.2);
        const luasBersih = Math.max(0, P * T - bukaan);
        const v = luasBersih * 2;
        return {
          volume: v,
          formula: `(${fmt(luasBersih, 2)} m²) × 2 sisi = ${fmt(v, 2)} m²`,
        };
      },
    },
    {
      key: "cat",
      label: "Pengecatan Dinding (2 Sisi)",
      ahspKeyword: "pengecatan tembok",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Pdinding);
        const T = n(i.Tdinding);
        const bukaan =
          n(i.jumlahPintu) * n(i.luasPintu, 1.8) +
          n(i.jumlahJendela) * n(i.luasJendela, 1.2);
        const luasBersih = Math.max(0, P * T - bukaan);
        const v = luasBersih * 2;
        return {
          volume: v,
          formula: `(${fmt(luasBersih, 2)} m²) × 2 sisi = ${fmt(v, 2)} m²`,
        };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 8: ATAP (Penutup + Nok + Listplank)
// ─────────────────────────────────────────────────────────────────────────────

const stageAtap: StageCalcDef = {
  type: "stage_atap",
  label: "Atap (4 items)",
  description:
    "Atap genteng / spandek + nok bubung + listplank. Luas atap miring auto-hitung dari sudut.",
  inputs: [
    {
      key: "Pbang",
      label: "Panjang Bangunan",
      unit: "m",
      default: 8,
      group: "Dimensi Atap",
    },
    {
      key: "Lbang",
      label: "Lebar Bangunan",
      unit: "m",
      default: 6,
      group: "Dimensi Atap",
    },
    {
      key: "sudut",
      label: "Sudut Kemiringan",
      unit: "°",
      default: 30,
      hint: "Default 30° untuk genteng. Spandek bisa lebih landai.",
      group: "Dimensi Atap",
    },
    {
      key: "overhang",
      label: "Overhang / Tritisan",
      unit: "m",
      default: 0.6,
      hint: "Lebar tritisan keluar bangunan. 0 = gak ada.",
      group: "Dimensi Atap",
    },
    {
      key: "panjangNok",
      label: "Panjang Nok / Bubung",
      unit: "m",
      default: 8,
      hint: "Biasanya = panjang bangunan untuk atap pelana",
      group: "Spesifikasi",
    },
    {
      key: "panjangListplank",
      label: "Panjang Listplank",
      unit: "m",
      default: 0,
      hint: "Keliling tepi atap. 0 = skip.",
      group: "Spesifikasi",
    },
    {
      key: "panjangTalang",
      label: "Panjang Talang Air",
      unit: "m",
      default: 0,
      hint: "Talang datar/jurai. 0 = skip.",
      group: "Spesifikasi",
    },
  ],
  items: [
    {
      key: "rangkaAtap",
      label: "Rangka Atap (Genteng Beton)",
      ahspKeyword: "rangka atap genteng",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Pbang);
        const L = n(i.Lbang);
        const overhang = n(i.overhang, 0.6);
        const sudut = n(i.sudut, 30);
        const cosS = Math.cos((sudut * Math.PI) / 180) || 1;
        const luasMiring = ((P + 2 * overhang) * (L + 2 * overhang)) / cosS;
        return {
          volume: luasMiring,
          formula: `((${fmt(P, 2)} + 2×${fmt(overhang, 2)}) × (${fmt(L, 2)} + 2×${fmt(overhang, 2)})) / cos(${fmt(sudut, 0)}°) = ${fmt(luasMiring, 2)} m²`,
        };
      },
    },
    {
      key: "penutupAtap",
      label: "Penutup Atap (Genteng / Spandek)",
      ahspKeyword: "atap genteng beton",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Pbang);
        const L = n(i.Lbang);
        const overhang = n(i.overhang, 0.6);
        const sudut = n(i.sudut, 30);
        const cosS = Math.cos((sudut * Math.PI) / 180) || 1;
        const v = ((P + 2 * overhang) * (L + 2 * overhang)) / cosS;
        return {
          volume: v,
          formula: `Sama dengan luas rangka = ${fmt(v, 2)} m²`,
        };
      },
    },
    {
      key: "nok",
      label: "Nok / Bubung Genteng",
      ahspKeyword: "nok bubung genteng",
      ahspUnit: "m",
      defaultEnabled: true,
      computeVolume: (i) => {
        const v = n(i.panjangNok);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m (input langsung)` };
      },
    },
    {
      key: "listplank",
      label: "Listplank Tepi Atap",
      ahspKeyword: "lisplank",
      ahspUnit: "m",
      defaultEnabled: false,
      showIf: (i) => n(i.panjangListplank) > 0,
      computeVolume: (i) => {
        const v = n(i.panjangListplank);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m (input langsung)` };
      },
    },
    {
      key: "reng",
      label: "Reng (dudukan genteng)",
      ahspKeyword: "reng baja ringan",
      ahspUnit: "m",
      defaultEnabled: false,
      computeVolume: (i) => {
        const P = n(i.Pbang);
        const L = n(i.Lbang);
        const overhang = n(i.overhang, 0.6);
        const sudut = n(i.sudut, 30);
        const cosS = Math.cos((sudut * Math.PI) / 180) || 1;
        const luasMiring = ((P + 2 * overhang) * (L + 2 * overhang)) / cosS;
        const v = luasMiring / 0.26; // jarak reng genteng ~26 cm
        if (v <= 0) return null;
        return {
          volume: v,
          formula: `${fmt(luasMiring, 2)} m² / 0,26 m = ${fmt(v, 2)} m reng`,
        };
      },
    },
    {
      key: "talang",
      label: "Talang Air",
      ahspKeyword: "talang",
      ahspUnit: "m",
      defaultEnabled: false,
      showIf: (i) => n(i.panjangTalang) > 0,
      computeVolume: (i) => {
        const v = n(i.panjangTalang);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m (input langsung)` };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 9: FINISHING LANTAI & PLAFON
// ─────────────────────────────────────────────────────────────────────────────

const stageFinishing: StageCalcDef = {
  type: "stage_finishing",
  label: "Finishing Lantai & Plafon (4 items)",
  description:
    "Lantai keramik + plafon + lis plafon + skirting. Tipikal interior finishing.",
  inputs: [
    {
      key: "luasLantai",
      label: "Luas Lantai Total",
      unit: "m²",
      default: 48,
      hint: "Total luas seluruh ruang",
      group: "Dimensi",
    },
    {
      key: "kelilingLantai",
      label: "Keliling Lantai (untuk Skirting)",
      unit: "m",
      default: 0,
      hint: "Total keliling perimeter ruang. 0 = skip skirting.",
      group: "Dimensi",
    },
    {
      key: "luasPlafon",
      label: "Luas Plafon",
      unit: "m²",
      default: 0,
      hint: "0 = sama dengan luas lantai. Beda kalau ada void.",
      group: "Dimensi",
    },
    {
      key: "kelilingPlafon",
      label: "Keliling Plafon (untuk Lis)",
      unit: "m",
      default: 0,
      hint: "Untuk pemasangan list plafon. 0 = skip.",
      group: "Dimensi",
    },
    {
      key: "ukuranKeramik",
      label: "Ukuran Keramik",
      unit: "cm",
      default: 30,
      group: "Spesifikasi",
      options: [
        { value: 20, label: "20 × 20 cm" },
        { value: 30, label: "30 × 30 cm (umum)" },
        { value: 40, label: "40 × 40 cm" },
        { value: 60, label: "60 × 60 cm (granit)" },
      ],
    },
  ],
  items: [
    {
      key: "lantaiKeramik",
      label: "Pemasangan Lantai Keramik",
      ahspKeyword: "pemasangan lantai keramik",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const v = n(i.luasLantai);
        return { volume: v, formula: `${fmt(v, 2)} m² (input langsung)` };
      },
    },
    {
      key: "skirting",
      label: "Skirting / Lis Lantai",
      ahspKeyword: "plint",
      ahspUnit: "m",
      defaultEnabled: false,
      showIf: (i) => n(i.kelilingLantai) > 0,
      computeVolume: (i) => {
        const v = n(i.kelilingLantai);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m (input langsung)` };
      },
    },
    {
      key: "plafon",
      label: "Pemasangan Plafon",
      ahspKeyword: "pemasangan rangka plafon hollow",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const luasPlafon = n(i.luasPlafon);
        const v = luasPlafon > 0 ? luasPlafon : n(i.luasLantai);
        return {
          volume: v,
          formula:
            luasPlafon > 0
              ? `${fmt(v, 2)} m² (input langsung)`
              : `${fmt(v, 2)} m² (= luas lantai)`,
        };
      },
    },
    {
      key: "lisPlafon",
      label: "Lis Plafon",
      ahspKeyword: "list plafon gypsum",
      ahspUnit: "m",
      defaultEnabled: false,
      showIf: (i) => n(i.kelilingPlafon) > 0,
      computeVolume: (i) => {
        const v = n(i.kelilingPlafon);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m (input langsung)` };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 10: MEP (Listrik + Sanitasi)
// ─────────────────────────────────────────────────────────────────────────────

const stageMEP: StageCalcDef = {
  type: "stage_mep",
  label: "MEP — Listrik & Sanitasi (5 items)",
  description:
    "Instalasi listrik (titik lampu, saklar, stop kontak) dan sanitasi (pipa air bersih, air kotor).",
  inputs: [
    {
      key: "titikLampu",
      label: "Jumlah Titik Lampu",
      unit: "titik",
      default: 0,
      group: "Listrik",
    },
    {
      key: "saklar",
      label: "Jumlah Saklar",
      unit: "titik",
      default: 0,
      group: "Listrik",
    },
    {
      key: "stopKontak",
      label: "Jumlah Stop Kontak",
      unit: "titik",
      default: 0,
      group: "Listrik",
    },
    {
      key: "panjangPipaBersih",
      label: "Panjang Pipa Air Bersih",
      unit: "m",
      default: 0,
      hint: "Total pipa PVC 1/2 inch dari toren ke kran",
      group: "Sanitasi",
    },
    {
      key: "panjangPipaKotor",
      label: "Panjang Pipa Air Kotor",
      unit: "m",
      default: 0,
      hint: "Total pipa PVC 4 inch dari WC ke septic tank",
      group: "Sanitasi",
    },
  ],
  items: [
    {
      key: "titikLampu",
      label: "Instalasi Titik Lampu",
      ahspKeyword: "instalasi titik lampu",
      ahspUnit: "titik",
      defaultEnabled: false,
      showIf: (i) => n(i.titikLampu) > 0,
      computeVolume: (i) => {
        const v = n(i.titikLampu);
        if (v <= 0) return null;
        return { volume: v, formula: `${v} titik` };
      },
    },
    {
      key: "saklar",
      label: "Pemasangan Saklar",
      ahspKeyword: "saklar",
      ahspUnit: "unit",
      defaultEnabled: false,
      showIf: (i) => n(i.saklar) > 0,
      computeVolume: (i) => {
        const v = n(i.saklar);
        if (v <= 0) return null;
        return { volume: v, formula: `${v} titik` };
      },
    },
    {
      key: "stopKontak",
      label: "Pemasangan Stop Kontak",
      ahspKeyword: "instalasi stop kontak",
      ahspUnit: "titik",
      defaultEnabled: false,
      showIf: (i) => n(i.stopKontak) > 0,
      computeVolume: (i) => {
        const v = n(i.stopKontak);
        if (v <= 0) return null;
        return { volume: v, formula: `${v} titik` };
      },
    },
    {
      key: "pipaBersih",
      label: "Pemasangan Pipa Air Bersih",
      ahspKeyword: "pipa pvc",
      ahspUnit: "m",
      defaultEnabled: false,
      showIf: (i) => n(i.panjangPipaBersih) > 0,
      computeVolume: (i) => {
        const v = n(i.panjangPipaBersih);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m` };
      },
    },
    {
      key: "pipaKotor",
      label: "Pemasangan Pipa Air Kotor",
      ahspKeyword: "pipa pvc",
      ahspUnit: "m",
      defaultEnabled: false,
      showIf: (i) => n(i.panjangPipaKotor) > 0,
      computeVolume: (i) => {
        const v = n(i.panjangPipaKotor);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m` };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage: BUKAAN (pintu, jendela, aksesoris) — gap audit: dulu cuma kusen
// ─────────────────────────────────────────────────────────────────────────────

const stageBukaan: StageCalcDef = {
  type: "stage_bukaan",
  label: "Pintu, Jendela & Aksesoris",
  description:
    "Kusen, daun pintu, jendela kaca, dan aksesoris (engsel/kunci/grendel). Isi jumlah unit, aksesoris auto-hitung. Tiap item AHSP terpisah.",
  inputs: [
    {
      key: "jmlPintu",
      label: "Jumlah Pintu",
      unit: "bh",
      default: 4,
      group: "Jumlah Unit",
    },
    {
      key: "jmlJendela",
      label: "Jumlah Jendela",
      unit: "bh",
      default: 6,
      group: "Jumlah Unit",
    },
    {
      key: "panjangKusen",
      label: "Total Panjang Kusen",
      unit: "m",
      default: 0,
      hint: "Keliling semua kusen pintu+jendela (m'). 0 = skip (mis. pakai kusen aluminium/uPVC).",
      group: "Kusen",
    },
    {
      key: "luasDaunPintu",
      label: "Luas per Daun Pintu",
      unit: "m2",
      default: 1.8,
      hint: "mis. 0,9 × 2,0 = 1,8 m²",
      group: "Daun Pintu",
    },
    {
      key: "engselPintu",
      label: "Engsel per Pintu",
      unit: "bh",
      default: 3,
      group: "Aksesoris",
    },
    {
      key: "engselJendela",
      label: "Engsel per Jendela",
      unit: "bh",
      default: 2,
      group: "Aksesoris",
    },
  ],
  items: [
    {
      key: "kusen",
      label: "Kusen Pintu & Jendela (kayu)",
      ahspKeyword: "kusen pintu jendela kayu",
      ahspUnit: "m",
      defaultEnabled: false,
      showIf: (i) => n(i.panjangKusen) > 0,
      computeVolume: (i) => {
        const v = n(i.panjangKusen);
        if (v <= 0) return null;
        return { volume: v, formula: `${fmt(v, 2)} m (input langsung)` };
      },
    },
    {
      key: "daunPintu",
      label: "Daun Pintu Panel",
      ahspKeyword: "pembuatan daun pintu panel",
      ahspUnit: "m2",
      defaultEnabled: true,
      showIf: (i) => n(i.jmlPintu) > 0,
      computeVolume: (i) => {
        const jml = n(i.jmlPintu);
        const luas = n(i.luasDaunPintu, 1.8);
        const v = jml * luas;
        if (v <= 0) return null;
        return {
          volume: v,
          formula: `${jml} pintu × ${fmt(luas, 2)} m² = ${fmt(v, 2)} m²`,
        };
      },
    },
    {
      key: "jendela",
      label: "Jendela Kaca (lengkap)",
      ahspKeyword: "pemasangan jendela kaca",
      ahspUnit: "bh",
      defaultEnabled: true,
      showIf: (i) => n(i.jmlJendela) > 0,
      computeVolume: (i) => {
        const v = n(i.jmlJendela);
        if (v <= 0) return null;
        return { volume: v, formula: `${v} jendela` };
      },
    },
    {
      key: "engsel",
      label: "Engsel (pintu + jendela)",
      ahspKeyword: "engsel",
      ahspUnit: "bh",
      defaultEnabled: true,
      showIf: (i) =>
        n(i.jmlPintu) * n(i.engselPintu, 3) +
          n(i.jmlJendela) * n(i.engselJendela, 2) >
        0,
      computeVolume: (i) => {
        const ep = n(i.jmlPintu) * n(i.engselPintu, 3);
        const ej = n(i.jmlJendela) * n(i.engselJendela, 2);
        const v = ep + ej;
        if (v <= 0) return null;
        return {
          volume: v,
          formula: `${n(i.jmlPintu)}×${n(i.engselPintu, 3)} + ${n(i.jmlJendela)}×${n(i.engselJendela, 2)} = ${v} bh`,
        };
      },
    },
    {
      key: "kunci",
      label: "Kunci Tanam (per pintu)",
      ahspKeyword: "kunci tanam",
      ahspUnit: "bh",
      defaultEnabled: true,
      showIf: (i) => n(i.jmlPintu) > 0,
      computeVolume: (i) => {
        const v = n(i.jmlPintu);
        if (v <= 0) return null;
        return { volume: v, formula: `${v} pintu` };
      },
    },
    {
      key: "grendel",
      label: "Grendel (per jendela)",
      ahspKeyword: "grendel",
      ahspUnit: "bh",
      defaultEnabled: true,
      showIf: (i) => n(i.jmlJendela) > 0,
      computeVolume: (i) => {
        const v = n(i.jmlJendela);
        if (v <= 0) return null;
        return { volume: v, formula: `${v} jendela` };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage: SANITAIR & SANITASI — gap audit: dulu tak ada sama sekali
// ─────────────────────────────────────────────────────────────────────────────

const stageSanitair: StageCalcDef = {
  type: "stage_sanitair",
  label: "Sanitair & Sanitasi",
  description:
    "Kloset, wastafel, floor drain, sumur resapan. Isi jumlah, tiap fixture jadi item AHSP terpisah. (Kran & septictank: tambah manual via picker bila perlu.)",
  inputs: [
    {
      key: "klosetDuduk",
      label: "Kloset Duduk / Monoblock",
      unit: "bh",
      default: 0,
      group: "Kloset",
    },
    {
      key: "klosetJongkok",
      label: "Kloset Jongkok",
      unit: "bh",
      default: 1,
      group: "Kloset",
    },
    {
      key: "wastafel",
      label: "Wastafel",
      unit: "bh",
      default: 0,
      group: "Fixture",
    },
    {
      key: "floorDrain",
      label: "Floor Drain",
      unit: "bh",
      default: 1,
      group: "Fixture",
    },
    {
      key: "sumurResapan",
      label: "Sumur Resapan",
      unit: "bh",
      default: 0,
      group: "Resapan",
    },
  ],
  items: [
    {
      key: "klosetDuduk",
      label: "Kloset Duduk / Monoblock",
      ahspKeyword: "closet duduk",
      ahspUnit: "bh",
      defaultEnabled: false,
      showIf: (i) => n(i.klosetDuduk) > 0,
      computeVolume: (i) => {
        const v = n(i.klosetDuduk);
        if (v <= 0) return null;
        return { volume: v, formula: `${v} bh` };
      },
    },
    {
      key: "klosetJongkok",
      label: "Kloset Jongkok",
      ahspKeyword: "closet jongkok",
      ahspUnit: "bh",
      defaultEnabled: true,
      showIf: (i) => n(i.klosetJongkok) > 0,
      computeVolume: (i) => {
        const v = n(i.klosetJongkok);
        if (v <= 0) return null;
        return { volume: v, formula: `${v} bh` };
      },
    },
    {
      key: "wastafel",
      label: "Wastafel",
      ahspKeyword: "wastafel",
      ahspUnit: "bh",
      defaultEnabled: false,
      showIf: (i) => n(i.wastafel) > 0,
      computeVolume: (i) => {
        const v = n(i.wastafel);
        if (v <= 0) return null;
        return { volume: v, formula: `${v} bh` };
      },
    },
    {
      key: "floorDrain",
      label: "Floor Drain",
      ahspKeyword: "floor drain",
      ahspUnit: "bh",
      defaultEnabled: true,
      showIf: (i) => n(i.floorDrain) > 0,
      computeVolume: (i) => {
        const v = n(i.floorDrain);
        if (v <= 0) return null;
        return { volume: v, formula: `${v} bh` };
      },
    },
    {
      key: "sumurResapan",
      label: "Sumur Resapan Air",
      ahspKeyword: "sumur resapan air",
      ahspUnit: "bh",
      defaultEnabled: false,
      showIf: (i) => n(i.sumurResapan) > 0,
      computeVolume: (i) => {
        const v = n(i.sumurResapan);
        if (v <= 0) return null;
        return { volume: v, formula: `${v} bh` };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage: FOOTPLATE / PONDASI TAPAK — restore gap Fase A (single calc di-hide).
// 3 output: beton + pembesian grid + bekisting sisi.
// ─────────────────────────────────────────────────────────────────────────────

const stageFootplate: StageCalcDef = {
  type: "stage_footplate",
  label: "Footplate / Pondasi Tapak Beton",
  description:
    "Pondasi telapak beton bertulang: beton + pembesian grid 2 arah + bekisting sisi. Isi dimensi tapak sekali, 3 item AHSP keluar.",
  inputs: [
    {
      key: "Ptapak",
      label: "Panjang Tapak (P)",
      unit: "m",
      default: 1.0,
      group: "Dimensi Tapak",
    },
    {
      key: "Ltapak",
      label: "Lebar Tapak (L)",
      unit: "m",
      default: 1.0,
      group: "Dimensi Tapak",
    },
    {
      key: "Ttapak",
      label: "Tebal Tapak (T)",
      unit: "m",
      default: 0.25,
      group: "Dimensi Tapak",
    },
    {
      key: "jmlTitik",
      label: "Jumlah Titik",
      unit: "bh",
      default: 4,
      group: "Dimensi Tapak",
    },
    {
      key: "mutuBeton",
      label: "Mutu Beton",
      unit: "K",
      default: 225,
      group: "Spesifikasi Beton",
      options: [
        { value: 175, label: "K-175 (fc 14.5)" },
        { value: 225, label: "K-225 (fc 19.3)" },
        { value: 275, label: "K-275 (fc 22.5)" },
      ],
    },
    {
      key: "selimut",
      label: "Selimut Beton (k)",
      unit: "m",
      default: 0.04,
      group: "Pembesian",
    },
    {
      key: "diaX",
      label: "Ø Tulangan Arah X",
      unit: "mm",
      default: 13,
      group: "Pembesian",
      options: [
        { value: 10, label: "Ø10 mm" },
        { value: 13, label: "Ø13 mm" },
        { value: 16, label: "Ø16 mm" },
      ],
    },
    {
      key: "jarakX",
      label: "Jarak Tulangan X",
      unit: "m",
      default: 0.15,
      group: "Pembesian",
    },
    {
      key: "diaY",
      label: "Ø Tulangan Arah Y",
      unit: "mm",
      default: 13,
      group: "Pembesian",
      options: [
        { value: 10, label: "Ø10 mm" },
        { value: 13, label: "Ø13 mm" },
        { value: 16, label: "Ø16 mm" },
      ],
    },
    {
      key: "jarakY",
      label: "Jarak Tulangan Y",
      unit: "m",
      default: 0.15,
      group: "Pembesian",
    },
  ],
  items: [
    {
      key: "betonFootplate",
      label: "Beton Footplate",
      ahspKeyword: (i) => mutuBetonKeyword(n(i.mutuBeton, 225)),
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Ptapak, 1);
        const L = n(i.Ltapak, 1);
        const T = n(i.Ttapak, 0.25);
        const jml = n(i.jmlTitik, 1);
        const v = P * L * T * jml;
        return {
          volume: v,
          formula: `${fmt(P, 2)} × ${fmt(L, 2)} × ${fmt(T, 2)} × ${jml} = ${fmt(v, 3)} m³`,
        };
      },
    },
    {
      key: "penulanganFootplate",
      label: "Penulangan Footplate (grid 2 arah)",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Ptapak, 1);
        const L = n(i.Ltapak, 1);
        const jml = n(i.jmlTitik, 1);
        const k = n(i.selimut, 0.04);
        const diaX = n(i.diaX, 13);
        const jX = n(i.jarakX, 0.15);
        const diaY = n(i.diaY, 13);
        const jY = n(i.jarakY, 0.15);
        // Grid bawah: batang arah X membentang sepanjang P (jumlah dibagi
        // di lebar L), batang arah Y membentang sepanjang L (dibagi di P).
        const lenP = Math.max(0, P - 2 * k);
        const lenL = Math.max(0, L - 2 * k);
        const nX = Math.floor(lenL / jX) + 1;
        const nY = Math.floor(lenP / jY) + 1;
        const wX = nX * lenP * rebarWeight(diaX);
        const wY = nY * lenL * rebarWeight(diaY);
        const total = (wX + wY) * jml;
        return {
          volume: total,
          formula: `X:${nX}×${fmt(lenP, 2)}m + Y:${nY}×${fmt(lenL, 2)}m, ×${jml} titik → ${fmt(total, 2)} kg`,
        };
      },
    },
    {
      key: "bekistingFootplate",
      label: "Bekisting Footplate (sisi)",
      ahspKeyword: "bekisting pondasi",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.Ptapak, 1);
        const L = n(i.Ltapak, 1);
        const T = n(i.Ttapak, 0.25);
        const jml = n(i.jmlTitik, 1);
        const v = 2 * (P + L) * T * jml;
        return {
          volume: v,
          formula: `2×(${fmt(P, 2)}+${fmt(L, 2)})×${fmt(T, 2)}×${jml} = ${fmt(v, 2)} m²`,
        };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage: TANGGA BETON — beton (plat miring + anak) + pembesian + bekisting.
// Model standar: waist slab + step prisms. Geometri pasti (bukan heuristik).
// ─────────────────────────────────────────────────────────────────────────────

const stageTangga: StageCalcDef = {
  type: "stage_tangga",
  label: "Tangga Beton",
  description:
    "Tangga beton bertulang: beton (plat miring + anak tangga) + pembesian + bekisting. Isi dimensi sekali, 3 item AHSP keluar.",
  inputs: [
    {
      key: "tinggiTotal",
      label: "Tinggi Total (lantai ke lantai)",
      unit: "m",
      default: 3.2,
      group: "Dimensi Tangga",
    },
    {
      key: "lebarTangga",
      label: "Lebar Tangga",
      unit: "m",
      default: 1.0,
      group: "Dimensi Tangga",
    },
    {
      key: "optrede",
      label: "Optrede (tinggi anak)",
      unit: "m",
      default: 0.18,
      group: "Dimensi Tangga",
    },
    {
      key: "antrede",
      label: "Antrede (lebar pijakan)",
      unit: "m",
      default: 0.28,
      group: "Dimensi Tangga",
    },
    {
      key: "tebalPlat",
      label: "Tebal Plat Tangga",
      unit: "m",
      default: 0.15,
      group: "Dimensi Tangga",
    },
    {
      key: "mutuBeton",
      label: "Mutu Beton",
      unit: "K",
      default: 225,
      group: "Spesifikasi Beton",
      options: [
        { value: 175, label: "K-175 (fc 14.5)" },
        { value: 225, label: "K-225 (fc 19.3)" },
        { value: 275, label: "K-275 (fc 22.5)" },
      ],
    },
    {
      key: "diaTul",
      label: "Ø Tulangan",
      unit: "mm",
      default: 13,
      group: "Pembesian",
      options: [
        { value: 10, label: "Ø10 mm" },
        { value: 13, label: "Ø13 mm" },
        { value: 16, label: "Ø16 mm" },
      ],
    },
    {
      key: "jarakTul",
      label: "Jarak Tulangan",
      unit: "m",
      default: 0.15,
      group: "Pembesian",
    },
  ],
  items: [
    {
      key: "betonTangga",
      label: "Beton Tangga (plat + anak)",
      ahspKeyword: (i) => mutuBetonKeyword(n(i.mutuBeton, 225)),
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const H = n(i.tinggiTotal, 3.2);
        const W = n(i.lebarTangga, 1);
        const opt = n(i.optrede, 0.18);
        const ant = n(i.antrede, 0.28);
        const tebal = n(i.tebalPlat, 0.15);
        const jmlAnak = Math.max(1, Math.round(H / opt));
        const run = jmlAnak * ant;
        const Lmiring = Math.sqrt(run * run + H * H);
        const vWaist = W * tebal * Lmiring;
        const vAnak = 0.5 * ant * opt * W * jmlAnak;
        const v = vWaist + vAnak;
        return {
          volume: v,
          formula: `Plat miring ${fmt(W, 2)}×${fmt(tebal, 2)}×${fmt(Lmiring, 2)} + ${jmlAnak} anak (½×${fmt(ant, 2)}×${fmt(opt, 2)}×${fmt(W, 2)}) = ${fmt(v, 3)} m³`,
        };
      },
    },
    {
      key: "penulanganTangga",
      label: "Penulangan Tangga",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: true,
      computeVolume: (i) => {
        const H = n(i.tinggiTotal, 3.2);
        const W = n(i.lebarTangga, 1);
        const opt = n(i.optrede, 0.18);
        const ant = n(i.antrede, 0.28);
        const dia = n(i.diaTul, 13);
        const jarak = n(i.jarakTul, 0.15);
        const jmlAnak = Math.max(1, Math.round(H / opt));
        const run = jmlAnak * ant;
        const Lmiring = Math.sqrt(run * run + H * H);
        // 1 lapis bawah: tulangan utama sepanjang miring + tulangan bagi melintang
        const nUtama = Math.floor(W / jarak) + 1;
        const nBagi = Math.floor(Lmiring / jarak) + 1;
        const panjang = nUtama * Lmiring + nBagi * W;
        const total = panjang * rebarWeight(dia);
        return {
          volume: total,
          formula: `Utama ${nUtama}×${fmt(Lmiring, 2)}m + bagi ${nBagi}×${fmt(W, 2)}m → ${fmt(total, 2)} kg`,
        };
      },
    },
    {
      key: "bekistingTangga",
      label: "Bekisting Tangga",
      ahspKeyword: "bekisting tangga",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const H = n(i.tinggiTotal, 3.2);
        const W = n(i.lebarTangga, 1);
        const opt = n(i.optrede, 0.18);
        const ant = n(i.antrede, 0.28);
        const jmlAnak = Math.max(1, Math.round(H / opt));
        const run = jmlAnak * ant;
        const Lmiring = Math.sqrt(run * run + H * H);
        const alas = W * Lmiring; // bekisting bawah plat miring
        const anak = opt * W * jmlAnak; // bekisting tegak tiap anak tangga
        const v = alas + anak;
        return {
          volume: v,
          formula: `Alas ${fmt(W, 2)}×${fmt(Lmiring, 2)} + ${jmlAnak} anak×${fmt(opt, 2)}×${fmt(W, 2)} = ${fmt(v, 2)} m²`,
        };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage: STRUKTUR PRAKTIS — kolom/ring/sloof praktis pengekang dinding bata.
// CATATAN PENTING: jumlah kolom praktis = ESTIMASI (rumus konfinemen umum SNI
// 2847 + praktik lapangan), volume tiap item BISA DIEDIT user setelah ditambah.
// ─────────────────────────────────────────────────────────────────────────────

/** Estimasi jumlah kolom praktis pengekang dinding. ESTIMASI konservatif: base
 *  dari max(spasi ≤3,5 m, 1 per 12 m²) + ~0,5 per bukaan (sudut/pertemuan/tepi
 *  bukaan). Hasil bisa di-override via inline-edit volume. */
function kolomPraktisCount(Pd: number, Td: number, nBukaan: number): number {
  const base = Math.max(Pd / 3.5, (Pd * Td) / 12);
  return Math.max(2, Math.round(base) + Math.round(nBukaan / 2));
}

const stagePraktis: StageCalcDef = {
  type: "stage_praktis",
  label: "Struktur Praktis (kolom/ring praktis)",
  description:
    "Kolom praktis + ring balok (+ sloof praktis opsional) pengekang dinding bata. Jumlah kolom DIESTIMASI dari panjang & luas dinding — volume bisa diedit setelah ditambah.",
  inputs: [
    {
      key: "Pdinding",
      label: "Total Panjang Dinding",
      unit: "m",
      default: 30,
      group: "Dimensi Dinding",
    },
    {
      key: "Tdinding",
      label: "Tinggi Dinding",
      unit: "m",
      default: 3,
      group: "Dimensi Dinding",
    },
    {
      key: "jumlahPintu",
      label: "Jumlah Pintu",
      unit: "bh",
      default: 5,
      group: "Bukaan",
    },
    {
      key: "jumlahJendela",
      label: "Jumlah Jendela",
      unit: "bh",
      default: 6,
      group: "Bukaan",
    },
    {
      key: "dimKolom",
      label: "Dimensi Kolom Praktis",
      unit: "cm",
      default: 11,
      group: "Spesifikasi",
      options: [
        { value: 11, label: "11×11" },
        { value: 13, label: "13×13" },
        { value: 15, label: "15×15 (SNI)" },
      ],
    },
    {
      key: "mutuPraktis",
      label: "Mutu Beton",
      unit: "K",
      default: 175,
      group: "Spesifikasi",
      options: [
        { value: 175, label: "K-175" },
        { value: 225, label: "K-225" },
      ],
    },
    {
      key: "aktifSloof",
      label: "Sloof Praktis",
      unit: "",
      default: 0,
      group: "Spesifikasi",
      options: [
        { value: 0, label: "Tidak (sudah ada sloof struktur)" },
        { value: 1, label: "Ya" },
      ],
    },
  ],
  items: [
    {
      key: "kolomPraktisBeton",
      label: "Kolom Praktis — Beton",
      ahspKeyword: (i) => mutuBetonKeyword(n(i.mutuPraktis, 175)),
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const Pd = n(i.Pdinding, 30);
        const Td = n(i.Tdinding, 3);
        const nB = n(i.jumlahPintu, 5) + n(i.jumlahJendela, 6);
        const nKP = kolomPraktisCount(Pd, Td, nB);
        const b = n(i.dimKolom, 11) / 100;
        const v = b * b * Td * nKP;
        return {
          volume: v,
          formula: `${nKP} kolom (estimasi) × ${fmt(b, 2)}×${fmt(b, 2)}×${fmt(Td, 2)} = ${fmt(v, 3)} m³`,
        };
      },
    },
    {
      key: "kolomPraktisBesi",
      label: "Kolom Praktis — Pembesian",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: true,
      computeVolume: (i) => {
        const Pd = n(i.Pdinding, 30);
        const Td = n(i.Tdinding, 3);
        const nB = n(i.jumlahPintu, 5) + n(i.jumlahJendela, 6);
        const nKP = kolomPraktisCount(Pd, Td, nB);
        const b = n(i.dimKolom, 11) / 100;
        const k = 0.02;
        const lUtama = Td * 4 * nKP;
        const wUtama = lUtama * rebarWeight(10);
        const kelBegel = stirrupPerimeter(b, b, k, 8);
        const jmlBegel = (Math.ceil(Td / 0.15) + 1) * nKP;
        const wBegel = kelBegel * jmlBegel * rebarWeight(8);
        const total = wUtama + wBegel;
        return {
          volume: total,
          formula: `${nKP} kolom: utama 4D10 ${fmt(lUtama, 1)} m + begel D8 kait 135° → ${fmt(total, 1)} kg`,
        };
      },
    },
    {
      key: "kolomPraktisBekisting",
      label: "Kolom Praktis — Bekisting",
      ahspKeyword: "bekisting kolom",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const Pd = n(i.Pdinding, 30);
        const Td = n(i.Tdinding, 3);
        const nB = n(i.jumlahPintu, 5) + n(i.jumlahJendela, 6);
        const nKP = kolomPraktisCount(Pd, Td, nB);
        const b = n(i.dimKolom, 11) / 100;
        // 2 sisi sebidang dinding (2 sisi lain nempel bata, tanpa bekisting).
        const v = 2 * b * Td * nKP;
        return {
          volume: v,
          formula: `${nKP} kolom × 2 sisi × ${fmt(b, 2)}×${fmt(Td, 2)} = ${fmt(v, 2)} m²`,
        };
      },
    },
    {
      key: "ringBalokBeton",
      label: "Ring Balok Praktis — Beton",
      ahspKeyword: (i) => mutuBetonKeyword(n(i.mutuPraktis, 175)),
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const Pd = n(i.Pdinding, 30);
        const v = 0.11 * 0.15 * Pd;
        return {
          volume: v,
          formula: `0,11×0,15×${fmt(Pd, 2)} = ${fmt(v, 3)} m³`,
        };
      },
    },
    {
      key: "ringBalokBesi",
      label: "Ring Balok Praktis — Pembesian",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: true,
      computeVolume: (i) => {
        const Pd = n(i.Pdinding, 30);
        const samb =
          Pd > STOCK_BAR_LENGTH ? Math.floor(Pd / STOCK_BAR_LENGTH) : 0;
        const lUtama = Pd * 4 + samb * lapSplice(10) * 4;
        const wUtama = lUtama * rebarWeight(10);
        const kelBegel = stirrupPerimeter(0.11, 0.15, 0.02, 8);
        const jmlBegel = Math.ceil(Pd / 0.15) + 1;
        const wBegel = kelBegel * jmlBegel * rebarWeight(8);
        const total = wUtama + wBegel;
        return {
          volume: total,
          formula: `utama 4D10 ${fmt(lUtama, 1)} m${samb > 0 ? " (+lewatan)" : ""} + begel D8 → ${fmt(total, 1)} kg`,
        };
      },
    },
    {
      key: "ringBalokBekisting",
      label: "Ring Balok Praktis — Bekisting",
      ahspKeyword: "bekisting sloof",
      ahspUnit: "m2",
      defaultEnabled: true,
      computeVolume: (i) => {
        const Pd = n(i.Pdinding, 30);
        const v = (2 * 0.15 + 0.11) * Pd; // 2 sisi + bawah (atas terbuka cor)
        return {
          volume: v,
          formula: `(2×0,15+0,11)×${fmt(Pd, 2)} = ${fmt(v, 2)} m²`,
        };
      },
    },
    {
      key: "sloofPraktisBeton",
      label: "Sloof Praktis — Beton",
      ahspKeyword: (i) => mutuBetonKeyword(n(i.mutuPraktis, 175)),
      ahspUnit: "m3",
      defaultEnabled: false,
      showIf: (i) => n(i.aktifSloof) > 0,
      computeVolume: (i) => {
        const Pd = n(i.Pdinding, 30);
        const v = 0.11 * 0.15 * Pd;
        return { volume: v, formula: `0,11×0,15×${fmt(Pd, 2)} = ${fmt(v, 3)} m³` };
      },
    },
    {
      key: "sloofPraktisBesi",
      label: "Sloof Praktis — Pembesian",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: false,
      showIf: (i) => n(i.aktifSloof) > 0,
      computeVolume: (i) => {
        const Pd = n(i.Pdinding, 30);
        const samb =
          Pd > STOCK_BAR_LENGTH ? Math.floor(Pd / STOCK_BAR_LENGTH) : 0;
        const lUtama = Pd * 4 + samb * lapSplice(10) * 4;
        const kelBegel = stirrupPerimeter(0.11, 0.15, 0.02, 8);
        const jmlBegel = Math.ceil(Pd / 0.15) + 1;
        const total =
          lUtama * rebarWeight(10) + kelBegel * jmlBegel * rebarWeight(8);
        return {
          volume: total,
          formula: `utama 4D10 ${fmt(lUtama, 1)} m + begel D8 → ${fmt(total, 1)} kg`,
        };
      },
    },
    {
      key: "sloofPraktisBekisting",
      label: "Sloof Praktis — Bekisting",
      ahspKeyword: "bekisting sloof",
      ahspUnit: "m2",
      defaultEnabled: false,
      showIf: (i) => n(i.aktifSloof) > 0,
      computeVolume: (i) => {
        const Pd = n(i.Pdinding, 30);
        const v = (2 * 0.15 + 0.11) * Pd;
        return { volume: v, formula: `(2×0,15+0,11)×${fmt(Pd, 2)} = ${fmt(v, 2)} m²` };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage: KOLOM SCHEDULE (multi-tipe) — 1 tabel, banyak tipe kolom (K1, K2, Kp…)
// ─────────────────────────────────────────────────────────────────────────────
const KOLOM_SCHEDULE: ScheduleDef = {
  group: "kolom",
  title: "Skedul Kolom (tambah baris per tipe: K1, K2, Kp, …)",
  hint: "Tiap baris = 1 tipe kolom. Beton + Pembesian + Bekisting dihitung dari tabel ini sekaligus.",
  columns: [
    { key: "tipe", label: "Tipe", kind: "text", default: "K1", width: "w-16" },
    { key: "b1", label: "b1", unit: "m", kind: "number", default: 0.15, width: "w-16" },
    { key: "b2", label: "b2", unit: "m", kind: "number", default: 0.3, width: "w-16" },
    { key: "T", label: "Tinggi", unit: "m", kind: "number", default: 4, width: "w-16" },
    { key: "jml", label: "Jml", unit: "bh", kind: "number", default: 1, width: "w-14" },
    {
      key: "D1", label: "Ø Utama", unit: "mm", kind: "select", default: 12, width: "w-20",
      options: [
        { value: 10, label: "Ø10" }, { value: 12, label: "Ø12" },
        { value: 13, label: "Ø13" }, { value: 16, label: "Ø16" },
        { value: 19, label: "Ø19" },
      ],
    },
    { key: "n1", label: "n Utama", unit: "btg", kind: "number", default: 4, width: "w-16" },
    {
      key: "D3", label: "Ø Begel", unit: "mm", kind: "select", default: 8, width: "w-20",
      options: [
        { value: 6, label: "Ø6" }, { value: 8, label: "Ø8" }, { value: 10, label: "Ø10" },
      ],
    },
    { key: "R", label: "Jarak Begel", unit: "m", kind: "number", default: 0.15, width: "w-20" },
  ],
};

const stageKolomSchedule: StageCalcDef = {
  type: "stage_kolom_schedule",
  label: "Kolom (Schedule / Multi-Tipe)",
  description:
    "Banyak tipe kolom (K1, K2, Kp …) dalam satu tabel. Isi tiap baris sekali → Beton + Pembesian + Bekisting teragregasi otomatis. Cocok rumah riil dgn 3-6 tipe kolom.",
  inputs: [
    {
      key: "mutuBeton", label: "Mutu Beton", unit: "K", default: 225,
      group: "Spesifikasi Beton (berlaku semua tipe)",
      options: [
        { value: 175, label: "K-175 (fc 14.5)" },
        { value: 225, label: "K-225 (fc 19.3)" },
        { value: 275, label: "K-275 (fc 22.5)" },
        { value: 300, label: "K-300 (fc 24.9)" },
      ],
    },
    {
      key: "selimut", label: "Selimut Beton (k)", unit: "m", default: 0.02,
      hint: "Berlaku semua tipe. Default 2 cm.",
      group: "Spesifikasi Beton (berlaku semua tipe)",
    },
  ],
  items: [
    {
      key: "betonKolomSch",
      label: "Beton Kolom (semua tipe)",
      ahspKeyword: (i) => mutuBetonKeyword(n(i.mutuBeton, 225)),
      ahspUnit: "m3",
      defaultEnabled: true,
      schedule: KOLOM_SCHEDULE,
      computeVolume: (_i, rows) => aggRows(rows, kolomRowBeton, "m3"),
    },
    {
      key: "penulanganKolomSch",
      label: "Penulangan Kolom (semua tipe)",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: true,
      schedule: KOLOM_SCHEDULE,
      computeVolume: (i, rows) =>
        aggRows(rows, (r) => kolomRowBesi(r, n(i.selimut, 0.02)), "kg"),
    },
    {
      key: "bekistingKolomSch",
      label: "Bekisting Kolom (semua tipe)",
      ahspKeyword: "bekisting untuk kolom",
      ahspUnit: "m2",
      defaultEnabled: true,
      schedule: KOLOM_SCHEDULE,
      computeVolume: (_i, rows) => aggRows(rows, kolomRowBekisting, "m2"),
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Export all stages
// ─────────────────────────────────────────────────────────────────────────────

export const STAGE_CALCULATORS: StageCalcDef[] = [
  stagePersiapan,
  stagePondasi,
  stageFootplate,
  stageBetonSloof,
  stageBetonKolom,
  stageKolomSchedule,
  stageBetonBalok,
  stageBetonPlat,
  stageTangga,
  stagePasangan,
  stagePraktis,
  stageAtap,
  stageFinishing,
  stageBukaan,
  stageSanitair,
  stageMEP,
];

export function getStage(type: string): StageCalcDef | null {
  return STAGE_CALCULATORS.find((s) => s.type === type) ?? null;
}
