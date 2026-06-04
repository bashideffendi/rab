import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  getLatestMaterialPrices,
  getIkkMultiplier,
  isCorruptPrice,
} from "./pricing";

/**
 * Breakdown kebutuhan material/upah/alat per project — SATU sumber kebenaran
 * dipakai export sheet (Upah/Bahan/Alat) + halaman /breakdown + /print, biar
 * angka konsisten. Region-aware (IKK diterapkan, sama dgn customUnitPrice yang
 * bentuk subtotal RAB) + sanity-gate (skip material tanpa harga / harga janggal
 * korup ×1000) → Σ Total Biaya rekonsiliasi ke subtotal RAB.
 *
 * Dulu /breakdown & /print hitung harga sendiri TANPA IKK & TANPA gate →
 * angka beda dari sheet export + dari subtotal RAB.
 */
export type BreakdownRow = {
  materialId: string;
  name: string;
  type: "tenaga" | "bahan" | "alat";
  unit: string;
  totalKebutuhan: number;
  hargaSatuan: number;
  totalBiaya: number;
};

const TYPE_ORDER: Record<string, number> = { tenaga: 0, bahan: 1, alat: 2 };

export async function loadBreakdownRows(
  projectId: string,
  regionId: string | null,
): Promise<BreakdownRow[]> {
  const aggRows = await db
    .select({
      materialId: schema.materials.id,
      name: schema.materials.name,
      type: schema.materials.type,
      unit: schema.materials.unit,
      coefficient: schema.ahspComponents.coefficient,
      itemVolume: schema.projectItems.volume,
    })
    .from(schema.projectItems)
    .innerJoin(
      schema.ahspComponents,
      eq(schema.ahspComponents.ahspItemId, schema.projectItems.ahspItemId),
    )
    .innerJoin(
      schema.materials,
      eq(schema.materials.id, schema.ahspComponents.materialId),
    )
    .where(eq(schema.projectItems.projectId, projectId));

  const map = new Map<string, BreakdownRow>();
  for (const r of aggRows) {
    const koef = Number(r.coefficient);
    const vol = Number(r.itemVolume);
    if (!Number.isFinite(koef) || !Number.isFinite(vol)) continue;
    let m = map.get(r.materialId);
    if (!m) {
      m = {
        materialId: r.materialId,
        name: r.name,
        type: r.type as BreakdownRow["type"],
        unit: r.unit,
        totalKebutuhan: 0,
        hargaSatuan: 0,
        totalBiaya: 0,
      };
      map.set(r.materialId, m);
    }
    m.totalKebutuhan += koef * vol;
  }
  if (map.size === 0) return [];

  const matIds = Array.from(map.keys());
  const priceMap = await getLatestMaterialPrices(matIds, regionId);
  const ikk = await getIkkMultiplier(regionId);

  const out: BreakdownRow[] = [];
  for (const m of map.values()) {
    const base = priceMap.get(m.materialId)?.price;
    if (base == null || isCorruptPrice(m.type, m.unit, base)) continue;
    m.hargaSatuan = base * ikk; // IKK diterapkan (konsisten dgn HSP item)
    m.totalBiaya = m.hargaSatuan * m.totalKebutuhan;
    out.push(m);
  }
  return out.sort(
    (a, b) =>
      (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) ||
      a.name.localeCompare(b.name),
  );
}
