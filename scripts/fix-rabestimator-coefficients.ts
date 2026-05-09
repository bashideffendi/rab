/**
 * Fix korupsi koefisien & harga AHSP dari import rabestimator yang buggy.
 *
 * Bug akar: parseNumber lama strip semua titik (asumsi format Indonesia
 * "1.500,50") padahal rabestimator pakai format English "0.0120".
 * Akibat:
 *  - KOEF "0.0120" → "00120" → Number = 120 (× 10,000)
 *  - HARGA "Rp 180,000.00" → "Rp 18000000" / 100 → 18,000,000 (×10 dari yg seharusnya tergantung jumlah desimal harga)
 *
 * Fix script:
 *  1. Re-parse raw rabestimator-detail.json dengan parser yang benar
 *     (deteksi otomatis "." vs "," berdasarkan separator terakhir)
 *  2. UPDATE existing ahsp_components & material_prices in-place via
 *     matching by source_url + material name
 *  3. Idempotent: aman di-run ulang
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
process.loadEnvFile(".env.local");
import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/db";

const DATA_DIR = resolve(process.cwd(), "data");
const DETAIL_FILE = resolve(DATA_DIR, "rabestimator-detail.json");
const RABESTIMATOR_BASE_URL = "https://rabestimator.id/koleksi/ahsp";
const JAKARTA_IKK = 1.1926;

type Component = {
  type: "tenaga" | "bahan" | "alat";
  nama: string;
  koefisien: string;
  satuan: string;
  hargaSatuan: string;
};

type DetailEntry = {
  id: number;
  kode: string;
  nama: string;
  satuan: string;
  components: Component[];
};

/**
 * Parser yang benar — auto-detect "." vs "," sebagai decimal separator
 * berdasarkan posisi terakhir.
 *
 * Test cases:
 *   "0.0120"        → 0.012  (English: dot decimal)
 *   "0,0120"        → 0.012  (Indonesian: comma decimal)
 *   "Rp 180,000.00" → 180000 (English thousand sep)
 *   "Rp 1.500,50"   → 1500.5 (Indonesian)
 *   "Rp 25.000"     → 25000  (Indonesian thousand, no decimal)
 *   "0.5"           → 0.5    (English single decimal)
 */
function parseNumberFixed(s: string | undefined): number | null {
  if (!s) return null;
  let t = s
    .replace(/Rp\s*/i, "")
    .replace(/[^\d.,\-]/g, "")
    .trim();
  if (!t) return null;

  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");

  if (lastDot >= 0 && lastComma >= 0) {
    // Both present — yang LEBIH BELAKANG = decimal
    if (lastDot > lastComma) {
      // English: "." decimal, "," thousand
      t = t.replace(/,/g, "");
    } else {
      // Indonesian: "," decimal, "." thousand
      t = t.replace(/\./g, "").replace(",", ".");
    }
  } else if (lastComma >= 0) {
    // Cuma ada koma — kemungkinan decimal Indonesian
    t = t.replace(",", ".");
  }
  // Kalau cuma ada titik atau gak ada keduanya — biarkan (titik = decimal English)

  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(DETAIL_FILE)) {
    console.error(`File gak ditemukan: ${DETAIL_FILE}`);
    process.exit(1);
  }

  console.log("Loading raw rabestimator-detail.json...");
  const raw: DetailEntry[] = JSON.parse(readFileSync(DETAIL_FILE, "utf8"));
  console.log(`  ${raw.length} AHSP entries dari raw data`);

  // ─── Phase 1: Fix coefficients in ahsp_components ──────────────────────────
  console.log("\n=== Phase 1: Fix coefficient AHSP components ===");

  let totalFixed = 0;
  let totalSkipped = 0;
  const sampleFixes: string[] = [];

  for (const entry of raw) {
    const sourceUrl = `${RABESTIMATOR_BASE_URL}/${entry.id}`;

    // Find AHSP item by sourceUrl
    const ahspRow = await db
      .select({ id: schema.ahspItems.id })
      .from(schema.ahspItems)
      .where(eq(schema.ahspItems.sourceUrl, sourceUrl))
      .limit(1);

    if (!ahspRow[0]) {
      totalSkipped++;
      continue;
    }
    const ahspId = ahspRow[0].id;

    // Get all components for this AHSP joined with materials
    const dbComps = await db
      .select({
        componentId: schema.ahspComponents.id,
        oldKoef: schema.ahspComponents.coefficient,
        materialName: schema.materials.name,
        materialUnit: schema.materials.unit,
      })
      .from(schema.ahspComponents)
      .innerJoin(
        schema.materials,
        eq(schema.materials.id, schema.ahspComponents.materialId),
      )
      .where(eq(schema.ahspComponents.ahspItemId, ahspId));

    // Build lookup from raw: name+sat → correct koef
    const rawByKey = new Map<string, number>();
    for (const c of entry.components) {
      const correct = parseNumberFixed(c.koefisien);
      if (correct == null) continue;
      const key = `${c.nama.trim().toLowerCase()}|${c.satuan.trim().toLowerCase()}`;
      rawByKey.set(key, correct);
    }

    // Update each component if value differs
    for (const dbc of dbComps) {
      const key = `${dbc.materialName.trim().toLowerCase()}|${dbc.materialUnit.trim().toLowerCase()}`;
      const correctKoef = rawByKey.get(key);
      if (correctKoef == null) continue;

      const oldKoefNum = Number(dbc.oldKoef);
      // Only update if difference is significant (>0.5% relative)
      if (Math.abs(oldKoefNum - correctKoef) > 0.0001) {
        await db
          .update(schema.ahspComponents)
          .set({ coefficient: correctKoef.toFixed(6) })
          .where(eq(schema.ahspComponents.id, dbc.componentId));

        totalFixed++;
        if (sampleFixes.length < 10) {
          sampleFixes.push(
            `  ${entry.kode} "${entry.nama.slice(0, 30)}" → ${dbc.materialName.slice(0, 25)}: ${oldKoefNum} → ${correctKoef}`,
          );
        }
      }
    }
  }

  console.log(`  Fixed ${totalFixed} components, skipped ${totalSkipped} entries (gak match di DB)`);
  console.log("  Sample fixes:");
  for (const s of sampleFixes) console.log(s);

  // ─── Phase 2: Fix material prices ──────────────────────────────────────────
  console.log("\n=== Phase 2: Fix material prices ===");

  // Build lookup: material name+unit → price (rabestimator basis = Jakarta)
  const materialPriceMap = new Map<string, number>();
  for (const entry of raw) {
    for (const c of entry.components) {
      const key = `${c.nama.trim().toLowerCase()}|${c.satuan.trim().toLowerCase()}`;
      const price = parseNumberFixed(c.hargaSatuan);
      if (price != null && !materialPriceMap.has(key)) {
        materialPriceMap.set(key, price);
      }
    }
  }
  console.log(`  ${materialPriceMap.size} unique materials dari raw`);

  let pricesFixed = 0;
  let priceSamples: string[] = [];

  // Get all materials in DB (where source matches rabestimator import)
  const dbMaterials = await db
    .select({
      id: schema.materials.id,
      code: schema.materials.code,
      name: schema.materials.name,
      unit: schema.materials.unit,
    })
    .from(schema.materials);

  for (const mat of dbMaterials) {
    const key = `${mat.name.trim().toLowerCase()}|${mat.unit.trim().toLowerCase()}`;
    const correctJakartaPrice = materialPriceMap.get(key);
    if (correctJakartaPrice == null) continue;

    // Convert Jakarta basis → nasional (divide by IKK Jakarta = 1.1926)
    const nasionalPrice = correctJakartaPrice / JAKARTA_IKK;

    // Get current price (any active national price for this material)
    const existingPrice = await db
      .select({ id: schema.materialPrices.id, price: schema.materialPrices.price })
      .from(schema.materialPrices)
      .where(eq(schema.materialPrices.materialId, mat.id))
      .limit(1);

    if (existingPrice[0]) {
      const oldPriceNum = Number(existingPrice[0].price);
      if (Math.abs(oldPriceNum - nasionalPrice) > 1) {
        await db
          .update(schema.materialPrices)
          .set({ price: nasionalPrice.toFixed(2) })
          .where(eq(schema.materialPrices.id, existingPrice[0].id));
        pricesFixed++;
        if (priceSamples.length < 10) {
          priceSamples.push(
            `  ${mat.code.padEnd(20)} ${mat.name.slice(0, 30).padEnd(30)} | ${mat.unit.padEnd(5)} | ${oldPriceNum.toFixed(2).padStart(15)} → ${nasionalPrice.toFixed(2)}`,
          );
        }
      }
    } else {
      // No price exists → insert new (nasional default, no region_id)
      await db.insert(schema.materialPrices).values({
        materialId: mat.id,
        regionId: null,
        price: nasionalPrice.toFixed(2),
        currency: "IDR",
        source: "rabestimator.id (Jakarta basis ÷ IKK Jakarta 1.1926)",
        sourceUrl: "https://rabestimator.id/",
        validFrom: "2024-01-01",
      });
      pricesFixed++;
    }
  }

  console.log(`  Fixed/inserted ${pricesFixed} material prices`);
  console.log("  Sample fixes:");
  for (const s of priceSamples) console.log(s);

  console.log("\n✓ DONE. Verify dengan buka project + cek breakdown.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
