import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { asc, eq, like } from "drizzle-orm";
import { db, schema } from "../src/db";

/**
 * Import scraped rabestimator ke RABin schema.
 *
 * Penting: AHSP code BUKAN unique (kode "1.1.1.1" bisa muncul di Permen PUPR
 * + SE DJBK + SNI = data berbeda meski kode sama). Kita simpan SEMUA entry
 * tanpa dedup-by-kode. Dedup pakai sourceUrl (= URL rabestimator.id/{id})
 * sebagai natural key — stabil per entry, idempotent re-runs.
 *
 * Logic:
 *  1. Load listing.json + detail.json, merge by ID (listing punya sumber)
 *  2. Dedup materials dari semua components (key: type + nama + satuan)
 *  3. Insert materials, prices (Jakarta basis / 1.1926 → nasional)
 *  4. Insert AHSP items (each unique by sourceUrl), components
 */

const DATA_DIR = resolve(process.cwd(), "data");
const LISTING_FILE = resolve(DATA_DIR, "rabestimator-listing.json");
const DETAIL_FILE = resolve(DATA_DIR, "rabestimator-detail.json");
const JAKARTA_IKK = 1.1926;
const RABESTIMATOR_BASE_URL = "https://rabestimator.id/koleksi/ahsp";

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

type ListingEntry = {
  id: number;
  kode: string;
  judul: string;
  satuan: string;
  hargaText: string;
  sumber: string;
};

function parseYearFromSumber(s: string | undefined): number | null {
  if (!s) return null;
  // Match 4-digit year 2010-2099
  const m = s.match(/\b(20[1-9]\d)\b/);
  return m ? Number(m[1]) : null;
}

function parseNumber(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s
    .replace(/Rp\s*/i, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.\-]/g, "")
    .trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function generateMaterialCode(
  type: Component["type"],
  index: number,
): string {
  const prefix = type === "tenaga" ? "TKG" : type === "bahan" ? "BHN" : "ALT";
  return `${prefix}.RABE.${String(index).padStart(4, "0")}`;
}

function inferAhspCategory(
  kode: string,
  sumber: string,
): "bina_marga" | "sda" | "cipta_karya" | "permukiman" | "umum" {
  const s = sumber.toLowerCase();
  if (/bina marga/.test(s) || /^A\.2/.test(kode) || /^2\./.test(kode))
    return "bina_marga";
  if (/sda|sumber daya air/.test(s) || /^A\.3/.test(kode) || /^3\./.test(kode))
    return "sda";
  if (/cipta karya/.test(s) || /^A\.4/.test(kode) || /^4\./.test(kode))
    return "cipta_karya";
  if (/permukiman/.test(s) || /^A\.5/.test(kode) || /^5\./.test(kode))
    return "permukiman";
  return "umum";
}

async function main() {
  if (!existsSync(DETAIL_FILE) || !existsSync(LISTING_FILE)) {
    throw new Error(
      `Data files missing. Run scraper first: npx tsx scripts/scrape-rabestimator.ts`,
    );
  }

  const detailData = JSON.parse(
    readFileSync(DETAIL_FILE, "utf8"),
  ) as DetailEntry[];
  const listingData = JSON.parse(
    readFileSync(LISTING_FILE, "utf8"),
  ) as ListingEntry[];

  // Build listing map by ID untuk lookup sumber + judul
  const listingById = new Map<number, ListingEntry>();
  for (const l of listingData) listingById.set(l.id, l);

  console.log(
    `→ Loaded ${detailData.length} detail entries + ${listingData.length} listing entries.`,
  );

  // ─── Phase 1: Dedup materials, track price samples per year ──────────────
  type MatKey = string;
  // Per material, group price samples by year (parsed from AHSP sumber)
  const matMap = new Map<
    MatKey,
    {
      type: Component["type"];
      nama: string;
      satuan: string;
      // Map<year (atau "unknown"), price samples>
      pricesByYear: Map<string, number[]>;
    }
  >();

  for (const entry of detailData) {
    const listing = listingById.get(entry.id);
    const year = parseYearFromSumber(listing?.sumber) ?? null;
    const yearKey = year ? String(year) : "unknown";

    for (const c of entry.components) {
      const key = `${c.type}|${normalizeName(c.nama)}|${normalizeName(c.satuan)}`;
      const harga = parseNumber(c.hargaSatuan);
      let mat = matMap.get(key);
      if (!mat) {
        mat = {
          type: c.type,
          nama: c.nama.trim(),
          satuan: c.satuan.trim(),
          pricesByYear: new Map(),
        };
        matMap.set(key, mat);
      }
      if (harga !== null && harga > 0) {
        const samples = mat.pricesByYear.get(yearKey) ?? [];
        samples.push(harga);
        mat.pricesByYear.set(yearKey, samples);
      }
    }
  }
  console.log(`→ Deduped to ${matMap.size} unique materials.`);
  // Stats: how many years detected
  const yearStats = new Map<string, number>();
  for (const m of matMap.values()) {
    for (const y of m.pricesByYear.keys()) {
      yearStats.set(y, (yearStats.get(y) ?? 0) + 1);
    }
  }
  console.log(
    `   Years detected: ${Array.from(yearStats.entries())
      .map(([y, c]) => `${y}=${c}`)
      .join(", ")}`,
  );

  // ─── Phase 2: Insert materials (idempotent by code) ──────────────────────
  let materialsInserted = 0;
  let materialsSkipped = 0;
  const materialIdByKey = new Map<MatKey, string>();

  const materialsList = Array.from(matMap.entries()).map(
    ([key, m], i) => ({
      key,
      code: generateMaterialCode(m.type, i + 1),
      ...m,
    }),
  );

  // Load existing materials by normalized name for cross-source dedup
  const existingMats = await db
    .select({
      id: schema.materials.id,
      code: schema.materials.code,
      name: schema.materials.name,
      type: schema.materials.type,
      unit: schema.materials.unit,
    })
    .from(schema.materials);

  const existingByNormKey = new Map<string, { id: string; code: string }>();
  for (const m of existingMats) {
    const k = `${m.type}|${normalizeName(m.name)}|${normalizeName(m.unit)}`;
    existingByNormKey.set(k, { id: m.id, code: m.code });
  }

  for (const m of materialsList) {
    const exists = existingByNormKey.get(m.key);
    if (exists) {
      materialIdByKey.set(m.key, exists.id);
      materialsSkipped++;
      continue;
    }

    const result = await db
      .insert(schema.materials)
      .values({
        code: m.code,
        name: m.nama,
        type: m.type,
        unit: m.satuan || "unit",
        notes: "Imported from rabestimator.id",
      })
      .onConflictDoNothing({ target: schema.materials.code })
      .returning({ id: schema.materials.id });

    if (result[0]) {
      materialIdByKey.set(m.key, result[0].id);
      materialsInserted++;
    } else {
      const [existingRow] = await db
        .select({ id: schema.materials.id })
        .from(schema.materials)
        .where(eq(schema.materials.code, m.code))
        .limit(1);
      if (existingRow) {
        materialIdByKey.set(m.key, existingRow.id);
        materialsSkipped++;
      }
    }
  }
  console.log(
    `   Materials: ${materialsInserted} inserted, ${materialsSkipped} skipped.`,
  );

  // ─── Phase 3: Material prices — batch insert per material ──────────────
  // Bulk fetch existing prices supaya gak query per-material
  const existingPrices = await db
    .select({ materialId: schema.materialPrices.materialId })
    .from(schema.materialPrices);
  const matsWithPrice = new Set(existingPrices.map((p) => p.materialId));

  type PriceRow = typeof schema.materialPrices.$inferInsert;
  const priceRowsToInsert: PriceRow[] = [];

  for (const m of materialsList) {
    const matId = materialIdByKey.get(m.key);
    if (!matId) continue;
    if (matsWithPrice.has(matId)) continue;

    for (const [yearKey, samples] of m.pricesByYear.entries()) {
      if (samples.length === 0) continue;
      const sorted = [...samples].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      if (!Number.isFinite(median) || median <= 0) continue;
      const nasional = median / JAKARTA_IKK;
      const year = yearKey === "unknown" ? 2025 : Number(yearKey);
      priceRowsToInsert.push({
        materialId: matId,
        regionId: null,
        price: nasional.toFixed(2),
        currency: "IDR",
        source: `rabestimator.id ${yearKey === "unknown" ? "(year unknown)" : yearKey} (Jakarta IKK ${JAKARTA_IKK} → nasional)`,
        validFrom: `${year}-01-01`,
      });
    }
  }

  // Batch insert in chunks of 200
  let pricesInserted = 0;
  const PRICE_CHUNK = 200;
  for (let i = 0; i < priceRowsToInsert.length; i += PRICE_CHUNK) {
    const chunk = priceRowsToInsert.slice(i, i + PRICE_CHUNK);
    await db.insert(schema.materialPrices).values(chunk);
    pricesInserted += chunk.length;
  }
  console.log(`   Material prices: ${pricesInserted} inserted (multi-year).`);

  // ─── Phase 4: AHSP items + components ────────────────────────────────────
  // Dedup: by sourceUrl (rabestimator.id/{id}) — stable & idempotent
  const existingAhsp = await db
    .select({
      id: schema.ahspItems.id,
      sourceUrl: schema.ahspItems.sourceUrl,
    })
    .from(schema.ahspItems)
    .where(like(schema.ahspItems.sourceModule, "%rabestimator%"));
  const ahspBySrcUrl = new Map<string, string>();
  for (const a of existingAhsp) {
    if (a.sourceUrl) ahspBySrcUrl.set(a.sourceUrl, a.id);
  }

  let ahspInserted = 0;
  let ahspSkipped = 0;
  let componentsInserted = 0;

  for (const entry of detailData) {
    if (!entry.kode || entry.components.length === 0) continue;

    const sourceUrl = `${RABESTIMATOR_BASE_URL}/${entry.id}`;
    if (ahspBySrcUrl.has(sourceUrl)) {
      ahspSkipped++;
      continue;
    }

    const listing = listingById.get(entry.id);
    const sumber = listing?.sumber ?? "rabestimator.id";

    const result = await db
      .insert(schema.ahspItems)
      .values({
        code: entry.kode,
        name: entry.nama,
        category: inferAhspCategory(entry.kode, sumber),
        unit: entry.satuan || "unit",
        sourceDoc: sumber,
        sourceModule: "rabestimator import",
        sourceSection: entry.kode,
        sourceUrl,
      })
      .returning({ id: schema.ahspItems.id });

    const ahspId = result[0]?.id;
    if (!ahspId) continue;
    ahspBySrcUrl.set(sourceUrl, ahspId);
    ahspInserted++;

    // Components — batch insert all at once per AHSP
    const seenInThisAhsp = new Set<string>();
    type CompRow = typeof schema.ahspComponents.$inferInsert;
    const compRows: CompRow[] = [];
    for (const c of entry.components) {
      const key = `${c.type}|${normalizeName(c.nama)}|${normalizeName(c.satuan)}`;
      if (seenInThisAhsp.has(key)) continue;
      seenInThisAhsp.add(key);
      const matId = materialIdByKey.get(key);
      if (!matId) continue;
      const koef = parseNumber(c.koefisien);
      if (koef === null || koef <= 0) continue;
      compRows.push({
        ahspItemId: ahspId,
        materialId: matId,
        coefficient: koef.toFixed(6),
      });
    }
    if (compRows.length > 0) {
      const inserted = await db
        .insert(schema.ahspComponents)
        .values(compRows)
        .onConflictDoNothing()
        .returning({ id: schema.ahspComponents.id });
      componentsInserted += inserted.length;
    }

    // Progress every 100 AHSP
    if (ahspInserted % 100 === 0) {
      console.log(`   ${ahspInserted} AHSP inserted (~${componentsInserted} components)`);
    }
  }

  console.log("");
  console.log("✓ Import selesai.");
  console.log(`  - AHSP items:     ${ahspInserted} inserted, ${ahspSkipped} skipped`);
  console.log(`  - Materials:      ${materialsInserted} inserted, ${materialsSkipped} skipped`);
  console.log(`  - Material prices: ${pricesInserted} inserted`);
  console.log(`  - AHSP components: ${componentsInserted} inserted`);
  console.log("");
  console.log("  AHSP duplikat (kode sama, sumber beda) di-import semua sebagai entry terpisah.");
  console.log(
    `  Konversi harga Jakarta → nasional: dibagi ${JAKARTA_IKK}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
