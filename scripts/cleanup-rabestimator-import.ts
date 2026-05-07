import { like } from "drizzle-orm";
import { db, schema } from "../src/db";

/**
 * Cleanup partial import dari rabestimator. Hapus:
 * - materials dengan code "TKG.RABE.*", "BHN.RABE.*", "ALT.RABE.*"
 * - material_prices yang tagged source "rabestimator.id*"
 * - ahsp_items yang source_doc contains "rabestimator"
 *
 * Cascade FK akan handle ahsp_components otomatis.
 *
 * Run: npx tsx --env-file=.env.local scripts/cleanup-rabestimator-import.ts
 */

async function main() {
  // 1. Hapus AHSP items dari rabestimator (cascades to ahsp_components)
  const ahspDeleted = await db
    .delete(schema.ahspItems)
    .where(like(schema.ahspItems.sourceModule, "%rabestimator%"))
    .returning({ id: schema.ahspItems.id });
  console.log(`✓ Deleted ${ahspDeleted.length} AHSP items.`);

  // 2. Hapus material_prices dengan source rabestimator
  const pricesDeleted = await db
    .delete(schema.materialPrices)
    .where(like(schema.materialPrices.source, "%rabestimator%"))
    .returning({ id: schema.materialPrices.id });
  console.log(`✓ Deleted ${pricesDeleted.length} material prices.`);

  // 3. Hapus materials dengan code "*.RABE.*"
  const matsDeleted = await db
    .delete(schema.materials)
    .where(like(schema.materials.code, "%.RABE.%"))
    .returning({ id: schema.materials.id });
  console.log(`✓ Deleted ${matsDeleted.length} materials.`);

  console.log("\n✓ Cleanup selesai. Re-run importer aman sekarang.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
