/**
 * Fix harga material yang corrupt dari rabestimator import (× 1000 lebih kecil
 * dari yang seharusnya, akibat parser bug yang sama).
 *
 * Strategi:
 *  1. Build price map dari raw JSON: (name+unit lowercase) → harga Jakarta
 *  2. Convert ke nasional: harga ÷ 1.1926 (IKK Jakarta)
 *  3. Untuk tiap material di DB:
 *     - Match by (name lower, unit lower) ke price map
 *     - Update existing material_prices (source seperti rabestimator/Jakarta)
 *       dengan harga benar
 *     - Insert baru kalau belum ada price
 *  4. Bulk via UPSERT pattern untuk efisiensi
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
process.loadEnvFile(".env.local");

const DATA_DIR = resolve(process.cwd(), "data");
const DETAIL_FILE = resolve(DATA_DIR, "rabestimator-detail.json");
const JAKARTA_IKK = 1.1926;
const SOURCE_TAG = "rabestimator.id (Jakarta ÷ IKK 1.1926)";
const SOURCE_URL = "https://rabestimator.id/";

type Component = {
  type: "tenaga" | "bahan" | "alat";
  nama: string;
  koefisien: string;
  satuan: string;
  hargaSatuan: string;
};

type DetailEntry = {
  id: number;
  components: Component[];
};

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
    if (lastDot > lastComma) {
      t = t.replace(/,/g, "");
    } else {
      t = t.replace(/\./g, "").replace(",", ".");
    }
  } else if (lastComma >= 0) {
    t = t.replace(",", ".");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  if (!existsSync(DETAIL_FILE)) {
    console.error(`File gak ditemukan: ${DETAIL_FILE}`);
    process.exit(1);
  }

  console.log("Loading raw rabestimator-detail.json...");
  const raw: DetailEntry[] = JSON.parse(readFileSync(DETAIL_FILE, "utf8"));

  // Build name+unit → price map (Jakarta basis)
  const priceMap = new Map<string, number>();
  for (const entry of raw) {
    for (const c of entry.components) {
      const key = `${c.nama.trim().toLowerCase()}|${c.satuan.trim().toLowerCase()}`;
      const p = parseNumberFixed(c.hargaSatuan);
      if (p != null && p > 0) {
        // Take MAX (in case different AHSPs report slightly different prices, use highest = most recent)
        const existing = priceMap.get(key);
        if (!existing || p > existing) priceMap.set(key, p);
      }
    }
  }
  console.log(`  ${priceMap.size} unique materials dengan harga`);

  const postgres = (await import("postgres")).default;
  const sql = postgres(process.env.DATABASE_URL!, { max: 5 });

  try {
    // Get all materials
    const mats = await sql<
      { id: string; code: string; name: string; unit: string }[]
    >`SELECT id, code, name, unit FROM materials`;
    console.log(`  ${mats.length} materials di DB`);

    // Build update batch
    const today = new Date().toISOString().slice(0, 10);
    let matched = 0;
    let updated = 0;
    let inserted = 0;
    let unchanged = 0;
    const sampleUpdates: string[] = [];

    // Process in batches of 50
    const BATCH = 50;
    for (let i = 0; i < mats.length; i += BATCH) {
      const batch = mats.slice(i, i + BATCH);

      for (const mat of batch) {
        const key = `${mat.name.trim().toLowerCase()}|${mat.unit.trim().toLowerCase()}`;
        const jakartaPrice = priceMap.get(key);
        if (jakartaPrice == null) continue;
        matched++;

        const nasionalPrice = jakartaPrice / JAKARTA_IKK;
        const priceStr = nasionalPrice.toFixed(2);

        // Check existing — pick price for region nasional (NULL)
        const existing = await sql<{ id: string; price: string }[]>`
          SELECT id, price::text as price
          FROM material_prices
          WHERE material_id = ${mat.id} AND region_id IS NULL
          LIMIT 1
        `;

        if (existing.length > 0) {
          const oldPrice = Number(existing[0].price);
          if (Math.abs(oldPrice - nasionalPrice) < 1) {
            unchanged++;
            continue;
          }
          await sql`
            UPDATE material_prices
            SET price = ${priceStr},
                source = ${SOURCE_TAG},
                source_url = ${SOURCE_URL},
                valid_from = '2024-01-01',
                valid_to = NULL
            WHERE id = ${existing[0].id}
          `;
          updated++;
          if (sampleUpdates.length < 8) {
            sampleUpdates.push(
              `  ${mat.code.padEnd(18)} ${mat.name.slice(0, 30).padEnd(30)} | ${oldPrice.toFixed(2).padStart(12)} → ${nasionalPrice.toFixed(2)}`,
            );
          }
        } else {
          await sql`
            INSERT INTO material_prices
              (material_id, region_id, price, currency, source, source_url, valid_from)
            VALUES
              (${mat.id}, NULL, ${priceStr}, 'IDR', ${SOURCE_TAG}, ${SOURCE_URL}, '2024-01-01')
          `;
          inserted++;
        }
      }

      console.log(
        `  Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(mats.length / BATCH)} — matched: ${matched}, updated: ${updated}, inserted: ${inserted}, unchanged: ${unchanged}`,
      );
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total matched:   ${matched}`);
    console.log(`Updated:         ${updated}`);
    console.log(`Inserted new:    ${inserted}`);
    console.log(`Unchanged:       ${unchanged}`);
    console.log(`No match in raw: ${mats.length - matched}`);
    console.log(`\nSample updates:`);
    for (const s of sampleUpdates) console.log(s);
  } finally {
    await sql.end();
  }

  console.log("\n✓ DONE.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
