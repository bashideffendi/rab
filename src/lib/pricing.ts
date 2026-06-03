import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Lookup harga material — SATU sumber kebenaran (sebelumnya diduplikat di 8
 * tempat dgn semantik beda-beda). Harga terbaru yang BERLAKU, region-aware.
 *
 * "Terbaru" = valid_from terbesar yang <= asOf, dengan valid_to NULL/future.
 * Two-pass region: coba harga region project dulu, fallback harga nasional
 * (region_id NULL). Cukup satu query (inArray) — hindari N+1.
 */

export type MaterialPrice = {
  price: number;
  source: string | null;
  validFrom: string;
};

export async function getLatestMaterialPrices(
  materialIds: string[],
  regionId?: string | null,
  asOf?: string,
): Promise<Map<string, MaterialPrice>> {
  const result = new Map<string, MaterialPrice>();
  if (materialIds.length === 0) return result;

  const today = asOf ?? new Date().toISOString().slice(0, 10);
  const prices = await db
    .select({
      materialId: schema.materialPrices.materialId,
      price: schema.materialPrices.price,
      regionId: schema.materialPrices.regionId,
      source: schema.materialPrices.source,
      validFrom: schema.materialPrices.validFrom,
    })
    .from(schema.materialPrices)
    .where(
      and(
        inArray(schema.materialPrices.materialId, materialIds),
        lte(schema.materialPrices.validFrom, today),
        or(
          isNull(schema.materialPrices.validTo),
          gte(schema.materialPrices.validTo, today),
        ),
      ),
    )
    .orderBy(desc(schema.materialPrices.validFrom));

  // Pass 1: harga region match (atau nasional). Skip harga daerah lain.
  for (const p of prices) {
    if (result.has(p.materialId)) continue;
    if (regionId && p.regionId !== regionId && p.regionId !== null) continue;
    result.set(p.materialId, {
      price: Number(p.price),
      source: p.source,
      validFrom: p.validFrom,
    });
  }
  // Pass 2: fallback — isi yang masih kosong dgn harga apa pun yang berlaku.
  for (const p of prices) {
    if (result.has(p.materialId)) continue;
    result.set(p.materialId, {
      price: Number(p.price),
      source: p.source,
      validFrom: p.validFrom,
    });
  }
  return result;
}

/**
 * Pengali IKK (Indeks Kemahalan Konstruksi) region = ikk/100. Nasional ≈ 100
 * → 1.0. Region NULL / tanpa data IKK → 1.0 (tarif nasional).
 */
export async function getIkkMultiplier(
  regionId?: string | null,
): Promise<number> {
  if (!regionId) return 1;
  const rows = await db
    .select({ ikk: schema.regions.ikk })
    .from(schema.regions)
    .where(eq(schema.regions.id, regionId))
    .limit(1);
  const ikk = rows[0]?.ikk;
  const n = ikk != null ? Number(ikk) : NaN;
  return Number.isFinite(n) && n > 0 ? n / 100 : 1;
}
