import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";

/**
 * Seed 38 provinsi Indonesia (BPS code 2-digit).
 * Idempotent: skip kalau code udah ada.
 *
 * Sumber kode BPS: https://sig.bps.go.id (master wilayah).
 * IKK column dibiarin NULL — di-populate via Stage B (BPS API sync).
 */

const PROVINSI = [
  ["11", "Aceh"],
  ["12", "Sumatera Utara"],
  ["13", "Sumatera Barat"],
  ["14", "Riau"],
  ["15", "Jambi"],
  ["16", "Sumatera Selatan"],
  ["17", "Bengkulu"],
  ["18", "Lampung"],
  ["19", "Kepulauan Bangka Belitung"],
  ["21", "Kepulauan Riau"],
  ["31", "DKI Jakarta"],
  ["32", "Jawa Barat"],
  ["33", "Jawa Tengah"],
  ["34", "DI Yogyakarta"],
  ["35", "Jawa Timur"],
  ["36", "Banten"],
  ["51", "Bali"],
  ["52", "Nusa Tenggara Barat"],
  ["53", "Nusa Tenggara Timur"],
  ["61", "Kalimantan Barat"],
  ["62", "Kalimantan Tengah"],
  ["63", "Kalimantan Selatan"],
  ["64", "Kalimantan Timur"],
  ["65", "Kalimantan Utara"],
  ["71", "Sulawesi Utara"],
  ["72", "Sulawesi Tengah"],
  ["73", "Sulawesi Selatan"],
  ["74", "Sulawesi Tenggara"],
  ["75", "Gorontalo"],
  ["76", "Sulawesi Barat"],
  ["81", "Maluku"],
  ["82", "Maluku Utara"],
  ["91", "Papua Barat"],
  ["92", "Papua Barat Daya"],
  ["94", "Papua"],
  ["95", "Papua Selatan"],
  ["96", "Papua Tengah"],
  ["97", "Papua Pegunungan"],
] as const;

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const [code, name] of PROVINSI) {
    const existing = await db
      .select({ id: schema.regions.id })
      .from(schema.regions)
      .where(eq(schema.regions.code, code))
      .limit(1);

    if (existing[0]) {
      skipped++;
      continue;
    }

    await db.insert(schema.regions).values({
      code,
      name,
      level: "provinsi",
    });
    inserted++;
  }

  console.log(
    `✓ Seed provinsi selesai. Inserted: ${inserted}, skipped (already exists): ${skipped}.`,
  );
  console.log(
    `  IKK columns dikosongin — populate via 'npm run bps:sync-ikk' (Stage B).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
