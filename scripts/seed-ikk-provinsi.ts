import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";

/**
 * Seed nilai IKK (Indeks Kemahalan Konstruksi) per provinsi.
 *
 * SUMBER: BPS publikasi "Indeks Kemahalan Konstruksi" tahunan.
 * IKK BPS gak ke-expose via webapi.bps.go.id (cuma PDF/Excel di
 * bps.go.id). Nilai di file ini ILUSTRATIF berdasar publikasi 2024,
 * di-rounded ke 1 desimal untuk kesederhanaan.
 *
 * VERIFY dengan publikasi resmi BPS sebelum dipakai untuk RAB
 * production. Update file ini saat publikasi tahunan baru rilis.
 *
 * Format: [BPS_code, IKK_value]
 * Acuan: nasional ≈ 100. > 100 = lebih mahal dari rata-rata.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-ikk-provinsi.ts
 */

const IKK_YEAR = 2024;
const IKK_SOURCE = "BPS IKK 2024 (illustrative — verify publikasi resmi)";

const IKK_PROVINSI: Array<[string, number]> = [
  ["11", 95.5], // Aceh
  ["12", 100.5], // Sumatera Utara
  ["13", 98.0], // Sumatera Barat
  ["14", 99.5], // Riau
  ["15", 96.0], // Jambi
  ["16", 97.0], // Sumatera Selatan
  ["17", 96.5], // Bengkulu
  ["18", 96.5], // Lampung
  ["19", 102.5], // Kep. Bangka Belitung
  ["21", 105.0], // Kepulauan Riau (Batam)
  ["31", 105.5], // DKI Jakarta
  ["32", 99.0], // Jawa Barat
  ["33", 95.0], // Jawa Tengah
  ["34", 95.5], // DI Yogyakarta
  ["35", 96.0], // Jawa Timur
  ["36", 99.5], // Banten
  ["51", 100.0], // Bali
  ["52", 102.5], // NTB
  ["53", 110.0], // NTT
  ["61", 102.0], // Kalimantan Barat
  ["62", 105.5], // Kalimantan Tengah
  ["63", 102.5], // Kalimantan Selatan
  ["64", 110.0], // Kalimantan Timur
  ["65", 116.5], // Kalimantan Utara
  ["71", 110.0], // Sulawesi Utara
  ["72", 108.5], // Sulawesi Tengah
  ["73", 99.0], // Sulawesi Selatan
  ["74", 105.5], // Sulawesi Tenggara
  ["75", 105.0], // Gorontalo
  ["76", 109.5], // Sulawesi Barat
  ["81", 117.5], // Maluku
  ["82", 121.5], // Maluku Utara
  ["91", 130.0], // Papua Barat
  ["92", 132.0], // Papua Barat Daya
  ["94", 135.5], // Papua
  ["95", 138.5], // Papua Selatan
  ["96", 145.0], // Papua Tengah
  ["97", 152.5], // Papua Pegunungan
];

async function main() {
  let updated = 0;
  let notFound = 0;

  for (const [code, ikk] of IKK_PROVINSI) {
    const result = await db
      .update(schema.regions)
      .set({
        ikk: ikk.toFixed(2),
        ikkYear: IKK_YEAR,
        ikkSource: IKK_SOURCE,
      })
      .where(eq(schema.regions.code, code))
      .returning({ id: schema.regions.id, name: schema.regions.name });

    if (result[0]) {
      updated++;
    } else {
      notFound++;
      console.log(`   ⚠ Region code ${code} gak ditemukan, skip.`);
    }
  }

  console.log("");
  console.log(`✓ IKK seeded — updated ${updated}, not found ${notFound}.`);
  console.log(`  Sumber: ${IKK_SOURCE}`);
  console.log(
    `  ⚠ Nilai ilustratif. Verify publikasi BPS resmi untuk production.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
