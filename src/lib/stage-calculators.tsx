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

/** Tabel diameter besi → berat per meter (kg/m) — standar AutoRAB. */
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

/** Mutu beton (K-X) → keyword search untuk AHSP beton */
function mutuBetonKeyword(k: number): string {
  // K-175 ≈ fc 14.5, K-225 ≈ fc 19.3, K-275 ≈ fc 22.5, K-300 ≈ fc 24.9
  if (k <= 175) return "beton mutu f'c 14";
  if (k <= 225) return "beton mutu f'c 19";
  if (k <= 275) return "beton mutu f'c 22";
  if (k <= 300) return "beton mutu f'c 24";
  return "beton mutu f'c 26";
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
// Stage 3: BETON SLOOF (mini-stage = 3 outputs: beton + tulangan + bekisting)
// ─────────────────────────────────────────────────────────────────────────────

const stageBetonSloof: StageCalcDef = {
  type: "stage_beton_sloof",
  label: "Beton Sloof (3 items)",
  description:
    "Sloof = balok bawah pondasi. 1 input dimensi → 3 items keluar: Beton + Penulangan + Bekisting.",
  inputs: [
    {
      key: "Lsloof",
      label: "Lebar Sloof",
      unit: "m",
      default: 0.15,
      group: "Dimensi Sloof",
    },
    {
      key: "Tsloof",
      label: "Tinggi Sloof",
      unit: "m",
      default: 0.2,
      group: "Dimensi Sloof",
    },
    {
      key: "Ptotal",
      label: "Total Panjang Sloof",
      unit: "m",
      default: 30,
      hint: "Total panjang seluruh jalur sloof",
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
        { value: 300, label: "K-300 (fc 24.9)" },
      ],
    },
    {
      key: "diaTulangan",
      label: "Ø Tulangan Utama",
      unit: "mm",
      default: 12,
      group: "Tulangan & Sengkang",
      options: [
        { value: 10, label: "Ø10 mm (0.62 kg/m)" },
        { value: 12, label: "Ø12 mm (0.89 kg/m)" },
        { value: 13, label: "Ø13 mm (1.04 kg/m)" },
        { value: 16, label: "Ø16 mm (1.58 kg/m)" },
      ],
    },
    {
      key: "jmlTulangan",
      label: "Jumlah Tulangan",
      unit: "btg",
      default: 4,
      hint: "Total batang (atas+bawah, biasanya 4-6)",
      group: "Tulangan & Sengkang",
    },
    {
      key: "diaSengkang",
      label: "Ø Sengkang",
      unit: "mm",
      default: 8,
      group: "Tulangan & Sengkang",
      options: [
        { value: 6, label: "Ø6 mm (0.22 kg/m)" },
        { value: 8, label: "Ø8 mm (0.39 kg/m)" },
        { value: 10, label: "Ø10 mm (0.62 kg/m)" },
      ],
    },
    {
      key: "jarakSengkang",
      label: "Jarak Sengkang",
      unit: "m",
      default: 0.15,
      hint: "Standar 10–20 cm",
      group: "Tulangan & Sengkang",
    },
  ],
  items: [
    {
      key: "betonSloof",
      label: "Beton Sloof",
      ahspKeyword: "beton mutu f'c 19",
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
      label: "Penulangan Sloof (Besi)",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: true,
      computeVolume: (i) => {
        const L = n(i.Lsloof);
        const T = n(i.Tsloof);
        const P = n(i.Ptotal);
        const dia = n(i.diaTulangan, 12);
        const jml = n(i.jmlTulangan, 4);
        const diaSeng = n(i.diaSengkang, 8);
        const jrkSeng = n(i.jarakSengkang, 0.15);

        // Berat tulangan utama
        const wPerM = REBAR_WEIGHT[dia] ?? 0.888;
        const beratUtama = P * jml * wPerM;
        // Berat sengkang
        const kelSeng = 2 * (L + T) + 0.2; // + overlap 20cm
        const wSengPerM = REBAR_WEIGHT[diaSeng] ?? 0.395;
        const jmlSeng = Math.ceil(P / jrkSeng) + 1;
        const beratSeng = jmlSeng * kelSeng * wSengPerM;
        const total = beratUtama + beratSeng;
        return {
          volume: total,
          formula: `Utama (${fmt(P, 2)}×${jml}×${fmt(wPerM, 3)}) + Sengkang (${jmlSeng}×${fmt(kelSeng, 2)}×${fmt(wSengPerM, 3)}) = ${fmt(total, 2)} kg`,
        };
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
        // 2 sisi vertikal + 1 bawah, atas terbuka
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
// Stage 4: BETON KOLOM (3 outputs: beton + tulangan + bekisting)
// ─────────────────────────────────────────────────────────────────────────────

const stageBetonKolom: StageCalcDef = {
  type: "stage_beton_kolom",
  label: "Beton Kolom (3 items)",
  description:
    "Kolom beton bertulang. 1 input → 3 items: Beton + Penulangan + Bekisting. Pakai per kelompok kolom (mis. K1 semua sama dimensi).",
  inputs: [
    {
      key: "Lx",
      label: "Sisi X Penampang",
      unit: "m",
      default: 0.2,
      hint: "Default 20×20 cm",
      group: "Dimensi Kolom",
    },
    {
      key: "Ly",
      label: "Sisi Y Penampang",
      unit: "m",
      default: 0.2,
      hint: "Sama Lx kalau persegi",
      group: "Dimensi Kolom",
    },
    {
      key: "Tkolom",
      label: "Tinggi Kolom",
      unit: "m",
      default: 3,
      group: "Dimensi Kolom",
    },
    {
      key: "nKolom",
      label: "Jumlah Kolom",
      unit: "buah",
      default: 6,
      hint: "Jumlah kolom dengan dimensi sama",
      group: "Dimensi Kolom",
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
        { value: 300, label: "K-300 (fc 24.9)" },
      ],
    },
    {
      key: "diaTulangan",
      label: "Ø Tulangan Utama",
      unit: "mm",
      default: 12,
      group: "Tulangan & Sengkang",
      options: [
        { value: 10, label: "Ø10 mm" },
        { value: 12, label: "Ø12 mm" },
        { value: 13, label: "Ø13 mm" },
        { value: 16, label: "Ø16 mm" },
        { value: 19, label: "Ø19 mm" },
      ],
    },
    {
      key: "jmlTulangan",
      label: "Jumlah Tulangan",
      unit: "btg",
      default: 4,
      hint: "Min 4 (1 di tiap sudut). 6/8 untuk kolom besar.",
      group: "Tulangan & Sengkang",
    },
    {
      key: "diaSengkang",
      label: "Ø Sengkang",
      unit: "mm",
      default: 8,
      group: "Tulangan & Sengkang",
      options: [
        { value: 6, label: "Ø6 mm" },
        { value: 8, label: "Ø8 mm" },
        { value: 10, label: "Ø10 mm" },
      ],
    },
    {
      key: "jarakSengkang",
      label: "Jarak Sengkang",
      unit: "m",
      default: 0.15,
      group: "Tulangan & Sengkang",
    },
  ],
  items: [
    {
      key: "betonKolom",
      label: "Beton Kolom",
      ahspKeyword: "beton mutu f'c 19",
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
      label: "Penulangan Kolom (Besi)",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: true,
      computeVolume: (i) => {
        const Lx = n(i.Lx);
        const Ly = n(i.Ly);
        const T = n(i.Tkolom);
        const nk = n(i.nKolom, 1);
        const dia = n(i.diaTulangan, 12);
        const jml = n(i.jmlTulangan, 4);
        const diaSeng = n(i.diaSengkang, 8);
        const jrkSeng = n(i.jarakSengkang, 0.15);

        const wPerM = REBAR_WEIGHT[dia] ?? 0.888;
        const beratUtama = T * jml * nk * wPerM;
        const kelSeng = 2 * (Lx + Ly) + 0.2;
        const wSengPerM = REBAR_WEIGHT[diaSeng] ?? 0.395;
        const jmlSengPerKolom = Math.ceil(T / jrkSeng) + 1;
        const beratSeng = jmlSengPerKolom * nk * kelSeng * wSengPerM;
        const total = beratUtama + beratSeng;
        return {
          volume: total,
          formula: `Utama (${fmt(T, 2)}×${jml}×${nk}×${fmt(wPerM, 3)}) + Sengkang (${jmlSengPerKolom}×${nk}×${fmt(kelSeng, 2)}×${fmt(wSengPerM, 3)}) = ${fmt(total, 2)} kg`,
        };
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
    "Balok beton bertulang (atas/lantai). Sama dengan sloof tapi posisi atas. Per kelompok balok dengan dimensi sama.",
  inputs: [
    {
      key: "Lbalok",
      label: "Lebar Balok",
      unit: "m",
      default: 0.2,
      group: "Dimensi Balok",
    },
    {
      key: "Tbalok",
      label: "Tinggi Balok",
      unit: "m",
      default: 0.4,
      group: "Dimensi Balok",
    },
    {
      key: "Ptotal",
      label: "Total Panjang Balok",
      unit: "m",
      default: 50,
      hint: "Total seluruh jalur balok",
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
        { value: 300, label: "K-300" },
      ],
    },
    {
      key: "diaTulangan",
      label: "Ø Tulangan Utama",
      unit: "mm",
      default: 13,
      group: "Tulangan & Sengkang",
      options: [
        { value: 10, label: "Ø10 mm" },
        { value: 12, label: "Ø12 mm" },
        { value: 13, label: "Ø13 mm" },
        { value: 16, label: "Ø16 mm" },
        { value: 19, label: "Ø19 mm" },
      ],
    },
    {
      key: "jmlTulangan",
      label: "Jumlah Tulangan",
      unit: "btg",
      default: 6,
      hint: "Atas + bawah (biasanya 6-8)",
      group: "Tulangan & Sengkang",
    },
    {
      key: "diaSengkang",
      label: "Ø Sengkang",
      unit: "mm",
      default: 8,
      group: "Tulangan & Sengkang",
      options: [
        { value: 8, label: "Ø8 mm" },
        { value: 10, label: "Ø10 mm" },
      ],
    },
    {
      key: "jarakSengkang",
      label: "Jarak Sengkang",
      unit: "m",
      default: 0.15,
      group: "Tulangan & Sengkang",
    },
  ],
  items: [
    {
      key: "betonBalok",
      label: "Beton Balok",
      ahspKeyword: "beton mutu f'c 19",
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
      label: "Penulangan Balok (Besi)",
      ahspKeyword: "penulangan kolom balok sloof",
      ahspUnit: "kg",
      defaultEnabled: true,
      computeVolume: (i) => {
        const L = n(i.Lbalok);
        const T = n(i.Tbalok);
        const P = n(i.Ptotal);
        const dia = n(i.diaTulangan, 13);
        const jml = n(i.jmlTulangan, 6);
        const diaSeng = n(i.diaSengkang, 8);
        const jrkSeng = n(i.jarakSengkang, 0.15);

        const wPerM = REBAR_WEIGHT[dia] ?? 1.042;
        const beratUtama = P * jml * wPerM;
        const kelSeng = 2 * (L + T) + 0.2;
        const wSengPerM = REBAR_WEIGHT[diaSeng] ?? 0.395;
        const jmlSeng = Math.ceil(P / jrkSeng) + 1;
        const beratSeng = jmlSeng * kelSeng * wSengPerM;
        const total = beratUtama + beratSeng;
        return {
          volume: total,
          formula: `Utama + Sengkang = ${fmt(total, 2)} kg`,
        };
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
          formula: `(2×${fmt(T, 3)} + ${fmt(L, 3)}) × ${fmt(P, 2)} = ${fmt(v, 2)} m²`,
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
      ahspKeyword: "beton mutu f'c 19",
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
      ahspKeyword: "dinding bata merah",
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
      ahspKeyword: "plesteran 1sp 1pp tebal 15",
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
      ahspKeyword: "rangka atap genteng",
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
      ahspKeyword: "listplank",
      ahspUnit: "m",
      defaultEnabled: false,
      showIf: (i) => n(i.panjangListplank) > 0,
      computeVolume: (i) => {
        const v = n(i.panjangListplank);
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
      ahspKeyword: "lantai keramik",
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
      ahspKeyword: "skirting",
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
      ahspKeyword: "rangka plafon hollow",
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
      ahspUnit: "titik",
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
// Export all stages
// ─────────────────────────────────────────────────────────────────────────────

export const STAGE_CALCULATORS: StageCalcDef[] = [
  stagePersiapan,
  stagePondasi,
  stageBetonSloof,
  stageBetonKolom,
  stageBetonBalok,
  stageBetonPlat,
  stagePasangan,
  stageAtap,
  stageFinishing,
  stageMEP,
];

export function getStage(type: string): StageCalcDef | null {
  return STAGE_CALCULATORS.find((s) => s.type === type) ?? null;
}
