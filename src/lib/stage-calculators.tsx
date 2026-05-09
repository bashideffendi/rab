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

export type StageItemDef = {
  /** Unique key dalam stage (untuk React key + checkbox state) */
  key: string;
  /** Label yang tampil di UI sub-item card */
  label: string;
  /** Keyword untuk search AHSP (case-insensitive). Best match auto-picked. */
  ahspKeyword: string;
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
   * Compute volume + formula breakdown dari shared inputs.
   * Return null kalau gak applicable (akan di-skip).
   */
  computeVolume: (inputs: Record<string, number>) => {
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
      ahspKeyword: "papan nama proyek",
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
      key: "tebalLantaiKerja",
      label: "Tebal Lantai Kerja Beton",
      unit: "m",
      default: 0,
      hint: "Beton tumbuk 1:3:5 dasar. 0 = skip.",
      group: "Spesifikasi",
    },
    {
      key: "rasioUruganKembali",
      label: "Rasio Urugan Kembali",
      unit: "%",
      default: 30,
      hint: "% galian yang diurug kembali (sisanya volume pondasi)",
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
        const L = n(i.lebarGalian, 0.6);
        const T = n(i.kedalaman, 0.6);
        const v = P * L * T;
        const formula = `${fmt(P, 2)} × ${fmt(L, 2)} × ${fmt(T, 2)} = ${fmt(v, 3)} m³`;
        return { volume: v, formula };
      },
    },
    {
      key: "uruganPasir",
      label: "Urugan Pasir Bawah Pondasi",
      ahspKeyword: "urugan pasir",
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
      key: "lantaiKerja",
      label: "Lantai Kerja Beton (Beton Tumbuk)",
      ahspKeyword: "beton tumbuk",
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
      ahspKeyword: "urugan kembali",
      ahspUnit: "m3",
      defaultEnabled: true,
      computeVolume: (i) => {
        const P = n(i.panjangTotal);
        const L = n(i.lebarGalian, 0.6);
        const T = n(i.kedalaman, 0.6);
        const galian = P * L * T;
        const rasio = n(i.rasioUruganKembali, 30) / 100;
        const v = galian * rasio;
        const formula = `(${fmt(galian, 3)} m³ galian) × ${fmt(n(i.rasioUruganKembali, 30), 0)}% = ${fmt(v, 3)} m³`;
        return { volume: v, formula };
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Export all stages
// ─────────────────────────────────────────────────────────────────────────────

export const STAGE_CALCULATORS: StageCalcDef[] = [
  stagePersiapan,
  stagePondasi,
];

export function getStage(type: string): StageCalcDef | null {
  return STAGE_CALCULATORS.find((s) => s.type === type) ?? null;
}
