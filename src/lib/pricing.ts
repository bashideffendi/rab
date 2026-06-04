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

/**
 * Hitung harga satuan (HSP biaya langsung) untuk banyak AHSP sekaligus —
 * SATU sumber kebenaran, region-aware + IKK. Dipakai semua jalur create item
 * (item-actions, stage-actions, ai-actions, template-actions) biar konsisten.
 *
 *   price[ahsp] = (Σ koef × harga_material_terbaru) × IKK(region)
 *
 * Cuma 3 query buat N AHSP (komponen bulk + harga bulk + IKK), bukan N+1.
 * Return Map ahspId → { price (string 2 desimal), missing (nama material tanpa harga) }.
 */
// Plafon harga per-satuan, di-bucket per TIPE komponen. Di atas plafon dianggap
// JANGGAL (data scrape sumber korup ×1000) → di-skip dari subtotal HSP + di-flag
// ke missing[] (UI sudah surface), biar gak diam-diam meledakkan harga satuan.
// HSP = Σ(tenaga)+Σ(bahan)+Σ(alat) → ketiganya dijaga, bukan cuma 'bahan'
// (dulu upah/alat korup ×1000 lolos). Plafon longgar: cukup di atas harga legit
// tertinggi tapi jauh di bawah korup×1000 (mis. kayu m³ legit ~4,5jt; dulu m³=3jt
// keliru nge-flag kayu sah → dinaikkan ke 25jt; ×1000 tetap ketangkep).
const PRICE_CEIL: Record<string, Record<string, number>> = {
  bahan: {
    kg: 200_000,
    liter: 200_000,
    ltr: 200_000,
    m: 2_000_000,
    m1: 2_000_000,
    "m'": 2_000_000,
    "m′": 2_000_000,
    m2: 2_000_000,
    m3: 25_000_000, // kayu kelas I/ulin bisa ~15-20jt/m³ → sah
    btg: 5_000_000,
    batang: 5_000_000,
    sak: 1_000_000,
    zak: 1_000_000,
    lbr: 1_000_000,
    lembar: 1_000_000,
  },
  alat: {
    // Alat berat legit bisa mahal (AMP ~12,5jt/jam) → plafon longgar. Korup
    // ×1000 alat termurah (~80jt/jam) tetap jauh di atas ini, jadi aman.
    jam: 30_000_000,
    hari: 50_000_000,
    hr: 50_000_000,
  },
  tenaga: {
    oh: 2_000_000, // upah harian (orang-hari) realistis <~2jt
    hari: 2_000_000,
    hr: 2_000_000,
  },
};

export async function computeAhspPrices(
  ahspIds: string[],
  regionId?: string | null,
  asOf?: string,
): Promise<Map<string, { price: string; missing: string[] }>> {
  const result = new Map<string, { price: string; missing: string[] }>();
  if (ahspIds.length === 0) return result;

  const comps = await db
    .select({
      ahspItemId: schema.ahspComponents.ahspItemId,
      materialId: schema.ahspComponents.materialId,
      materialName: schema.materials.name,
      materialType: schema.materials.type,
      materialUnit: schema.materials.unit,
      coefficient: schema.ahspComponents.coefficient,
    })
    .from(schema.ahspComponents)
    .innerJoin(
      schema.materials,
      eq(schema.materials.id, schema.ahspComponents.materialId),
    )
    .where(inArray(schema.ahspComponents.ahspItemId, ahspIds));

  const matIds = [...new Set(comps.map((c) => c.materialId))];
  const priceMap = await getLatestMaterialPrices(matIds, regionId, asOf);
  const ikk = await getIkkMultiplier(regionId);

  const byAhsp = new Map<string, typeof comps>();
  for (const c of comps) {
    const list = byAhsp.get(c.ahspItemId) ?? [];
    list.push(c);
    byAhsp.set(c.ahspItemId, list);
  }

  for (const id of ahspIds) {
    const list = byAhsp.get(id) ?? [];
    let base = 0;
    const missing: string[] = [];
    for (const c of list) {
      const price = priceMap.get(c.materialId)?.price;
      const coef = Number(c.coefficient);
      if (price == null) {
        missing.push(c.materialName);
        continue;
      }
      // Sanity-gate harga komponen janggal (korup ×1000): skip + flag, jangan
      // diam-diam masuk subtotal & meledakkan HSP. Berlaku tenaga/bahan/alat.
      const u = (c.materialUnit ?? "")
        .toLowerCase()
        .replace(/['`’′]/g, "")
        .trim();
      const ceil = PRICE_CEIL[c.materialType ?? ""]?.[u];
      if (ceil != null && price > ceil) {
        missing.push(
          `${c.materialName} (harga janggal Rp ${Math.round(price).toLocaleString("id-ID")})`,
        );
        continue;
      }
      if (Number.isFinite(coef) && Number.isFinite(price)) base += coef * price;
    }
    result.set(id, { price: (base * ikk).toFixed(2), missing });
  }
  return result;
}
