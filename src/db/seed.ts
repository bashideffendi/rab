import { eq } from "drizzle-orm";
import { db, schema } from "./index";

/**
 * Seed baseline RABin development.
 *
 * Data ilustratif berdasarkan format Permen PUPR No. 1/2022 (4 modul AHSP).
 * Nilai koefisien & harga adalah representatif tipikal — VERIFY dengan
 * dokumen Permen PUPR resmi sebelum dipakai untuk RAB production.
 *
 * Idempotent: kalau region "Nasional" sudah ada, seed di-skip.
 *
 * Run: npm run db:seed
 */

const SOURCE_DOC = "Permen PUPR No. 1/2022 (illustrative)";
const SOURCE_MODULE = "Modul 4 — Cipta Karya";
const VALID_FROM = "2025-01-01";

type SeedMaterial = {
  code: string;
  name: string;
  type: "tenaga" | "bahan" | "alat";
  unit: string;
  price: string; // IDR per unit
};

const MATERIALS: SeedMaterial[] = [
  // Tenaga (OH = Orang Hari)
  { code: "TKG.001", name: "Mandor", type: "tenaga", unit: "OH", price: "150000" },
  { code: "TKG.002", name: "Kepala tukang", type: "tenaga", unit: "OH", price: "130000" },
  { code: "TKG.003", name: "Tukang batu", type: "tenaga", unit: "OH", price: "120000" },
  { code: "TKG.004", name: "Tukang kayu", type: "tenaga", unit: "OH", price: "120000" },
  { code: "TKG.005", name: "Tukang besi", type: "tenaga", unit: "OH", price: "120000" },
  { code: "TKG.006", name: "Pekerja", type: "tenaga", unit: "OH", price: "100000" },
  // Bahan
  { code: "BHN.001", name: "Semen Portland Type I", type: "bahan", unit: "kg", price: "1500" },
  { code: "BHN.002", name: "Pasir pasang", type: "bahan", unit: "m3", price: "350000" },
  { code: "BHN.003", name: "Pasir beton", type: "bahan", unit: "m3", price: "400000" },
  { code: "BHN.004", name: "Kerikil/split 2-3 cm", type: "bahan", unit: "m3", price: "380000" },
  { code: "BHN.005", name: "Batu kali belah", type: "bahan", unit: "m3", price: "250000" },
  { code: "BHN.006", name: "Air kerja", type: "bahan", unit: "liter", price: "50" },
  { code: "BHN.007", name: "Besi beton polos D-12", type: "bahan", unit: "kg", price: "13000" },
  { code: "BHN.008", name: "Kayu kelas II (4/6, 5/7)", type: "bahan", unit: "m3", price: "4500000" },
  // Alat
  { code: "ALT.001", name: "Concrete mixer 0.3 m3", type: "alat", unit: "jam", price: "250000" },
  { code: "ALT.002", name: "Vibrator beton", type: "alat", unit: "jam", price: "80000" },
];

type SeedAhsp = {
  code: string;
  name: string;
  unit: string;
  category: "cipta_karya" | "bina_marga" | "sda" | "permukiman" | "umum";
  components: Array<{ materialCode: string; coefficient: string }>;
};

const AHSP_ITEMS: SeedAhsp[] = [
  {
    code: "A.4.1.1.1",
    name: "Galian tanah biasa kedalaman 1 meter",
    unit: "m3",
    category: "cipta_karya",
    components: [
      { materialCode: "TKG.001", coefficient: "0.025" },
      { materialCode: "TKG.006", coefficient: "0.75" },
    ],
  },
  {
    code: "A.4.1.1.5",
    name: "Urugan kembali galian",
    unit: "m3",
    category: "cipta_karya",
    components: [
      { materialCode: "TKG.001", coefficient: "0.0167" },
      { materialCode: "TKG.006", coefficient: "0.5" },
    ],
  },
  {
    code: "A.4.1.1.10",
    name: "Pasangan batu kali campuran 1 PC : 4 PP",
    unit: "m3",
    category: "cipta_karya",
    components: [
      { materialCode: "BHN.005", coefficient: "1.2" },
      { materialCode: "BHN.001", coefficient: "163" },
      { materialCode: "BHN.002", coefficient: "0.52" },
      { materialCode: "BHN.006", coefficient: "215" },
      { materialCode: "TKG.001", coefficient: "0.06" },
      { materialCode: "TKG.002", coefficient: "0.06" },
      { materialCode: "TKG.003", coefficient: "0.6" },
      { materialCode: "TKG.006", coefficient: "1.5" },
    ],
  },
  {
    code: "A.4.1.1.20",
    name: "Beton mutu f'c = 19,3 MPa (K-225)",
    unit: "m3",
    category: "cipta_karya",
    components: [
      { materialCode: "BHN.001", coefficient: "371" },
      { materialCode: "BHN.003", coefficient: "0.499" },
      { materialCode: "BHN.004", coefficient: "0.776" },
      { materialCode: "BHN.006", coefficient: "215" },
      { materialCode: "ALT.001", coefficient: "0.5" },
      { materialCode: "ALT.002", coefficient: "0.5" },
      { materialCode: "TKG.001", coefficient: "0.083" },
      { materialCode: "TKG.002", coefficient: "0.028" },
      { materialCode: "TKG.003", coefficient: "0.275" },
      { materialCode: "TKG.006", coefficient: "1.65" },
    ],
  },
  {
    code: "A.4.1.1.30",
    name: "Plesteran campuran 1 PC : 4 PP tebal 15 mm",
    unit: "m2",
    category: "cipta_karya",
    components: [
      { materialCode: "BHN.001", coefficient: "5.18" },
      { materialCode: "BHN.002", coefficient: "0.0207" },
      { materialCode: "TKG.001", coefficient: "0.015" },
      { materialCode: "TKG.002", coefficient: "0.015" },
      { materialCode: "TKG.003", coefficient: "0.15" },
      { materialCode: "TKG.006", coefficient: "0.3" },
    ],
  },
  {
    code: "A.4.2.1.1",
    name: "Pembersihan lapangan",
    unit: "m2",
    category: "umum",
    components: [
      { materialCode: "TKG.001", coefficient: "0.0033" },
      { materialCode: "TKG.006", coefficient: "0.1" },
    ],
  },
];

async function main() {
  console.log("→ Cek apakah seed sudah pernah dijalankan...");
  const existing = await db
    .select({ id: schema.regions.id })
    .from(schema.regions)
    .where(eq(schema.regions.code, "ID"))
    .limit(1);

  if (existing.length > 0) {
    console.log("✓ Region 'Nasional' sudah ada — seed di-skip.");
    console.log("  Untuk re-seed: DELETE manual dari DB lalu run lagi.");
    process.exit(0);
  }

  console.log("→ Seed region Nasional...");
  const [region] = await db
    .insert(schema.regions)
    .values({ code: "ID", name: "Nasional (Indonesia)", level: "nasional" })
    .returning({ id: schema.regions.id });

  console.log(`→ Seed ${MATERIALS.length} materials...`);
  const materialIdByCode = new Map<string, string>();
  for (const m of MATERIALS) {
    const [row] = await db
      .insert(schema.materials)
      .values({
        code: m.code,
        name: m.name,
        type: m.type,
        unit: m.unit,
      })
      .returning({ id: schema.materials.id });
    materialIdByCode.set(m.code, row.id);
  }

  console.log(`→ Seed harga material nasional (${MATERIALS.length} entries)...`);
  for (const m of MATERIALS) {
    await db.insert(schema.materialPrices).values({
      materialId: materialIdByCode.get(m.code)!,
      regionId: region.id,
      price: m.price,
      currency: "IDR",
      source: "Harga representatif 2025 (illustrative)",
      validFrom: VALID_FROM,
    });
  }

  console.log(`→ Seed ${AHSP_ITEMS.length} AHSP items + komponen...`);
  for (const a of AHSP_ITEMS) {
    const [ahsp] = await db
      .insert(schema.ahspItems)
      .values({
        code: a.code,
        name: a.name,
        category: a.category,
        unit: a.unit,
        sourceDoc: SOURCE_DOC,
        sourceModule: SOURCE_MODULE,
        sourceSection: a.code,
        notes: "Koefisien ilustratif. Verify dengan Permen PUPR resmi.",
      })
      .returning({ id: schema.ahspItems.id });

    for (const c of a.components) {
      const materialId = materialIdByCode.get(c.materialCode);
      if (!materialId) {
        throw new Error(
          `Material ${c.materialCode} tidak ditemukan untuk AHSP ${a.code}`,
        );
      }
      await db.insert(schema.ahspComponents).values({
        ahspItemId: ahsp.id,
        materialId,
        coefficient: c.coefficient,
      });
    }
  }

  console.log("");
  console.log("✓ Seed selesai.");
  console.log(`  - 1 region (Nasional)`);
  console.log(`  - ${MATERIALS.length} materials`);
  console.log(`  - ${MATERIALS.length} harga nasional`);
  console.log(`  - ${AHSP_ITEMS.length} AHSP items`);
  console.log(
    `  - ${AHSP_ITEMS.reduce((s, a) => s + a.components.length, 0)} ahsp_components`,
  );
  console.log("");
  console.log(
    "⚠ Data ilustratif. Verify dengan Permen PUPR No. 1/2022 sebelum dipakai untuk RAB production.",
  );

  process.exit(0);
}

main().catch((e) => {
  console.error("✗ Seed gagal:", e);
  process.exit(1);
});
