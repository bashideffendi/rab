import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NATIONAL_REGION_CODE = "ID";

/**
 * GET /api/ahsp/[id]/breakdown?regionId=xxx&volume=1.5
 *
 * Returns full AHSP component breakdown:
 *  - Tiap komponen: name, type, unit, koefisien, qty (= koef × volume),
 *    harga material, line total
 *  - IKK multiplier dari region project
 *  - Total = sum(line total) × multiplier
 *
 * Buat detail view RAB Pro style — user bisa lihat WHERE the cost
 * comes from, bukan cuma total.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Login dulu." }, { status: 401 });
  }

  const { id: ahspItemId } = await params;
  const url = new URL(request.url);
  const regionId = url.searchParams.get("regionId");
  const volumeRaw = url.searchParams.get("volume") ?? "1";
  const volume = Number(volumeRaw);
  if (!Number.isFinite(volume) || volume < 0) {
    return Response.json(
      { error: "Volume tidak valid." },
      { status: 400 },
    );
  }

  // Load AHSP info
  const [ahsp] = await db
    .select({
      id: schema.ahspItems.id,
      code: schema.ahspItems.code,
      name: schema.ahspItems.name,
      unit: schema.ahspItems.unit,
      sourceDoc: schema.ahspItems.sourceDoc,
    })
    .from(schema.ahspItems)
    .where(eq(schema.ahspItems.id, ahspItemId))
    .limit(1);

  if (!ahsp) {
    return Response.json(
      { error: "AHSP tidak ditemukan." },
      { status: 404 },
    );
  }

  // Load all components
  const components = await db
    .select({
      coefficient: schema.ahspComponents.coefficient,
      materialId: schema.materials.id,
      materialCode: schema.materials.code,
      materialName: schema.materials.name,
      materialType: schema.materials.type,
      materialUnit: schema.materials.unit,
      componentNotes: schema.ahspComponents.notes,
    })
    .from(schema.ahspComponents)
    .innerJoin(
      schema.materials,
      eq(schema.materials.id, schema.ahspComponents.materialId),
    )
    .where(eq(schema.ahspComponents.ahspItemId, ahspItemId));

  // National region fallback
  const [nationalRegion] = await db
    .select({ id: schema.regions.id })
    .from(schema.regions)
    .where(eq(schema.regions.code, NATIONAL_REGION_CODE))
    .limit(1);
  const nationalId = nationalRegion?.id ?? null;

  const today = new Date().toISOString().slice(0, 10);

  // Get IKK multiplier
  let multiplier = 1;
  let ikkValue: string | null = null;
  let regionName: string | null = null;
  if (regionId) {
    const [region] = await db
      .select({
        ikk: schema.regions.ikk,
        name: schema.regions.name,
      })
      .from(schema.regions)
      .where(eq(schema.regions.id, regionId))
      .limit(1);
    if (region?.ikk) {
      const ikk = Number(region.ikk);
      if (Number.isFinite(ikk) && ikk > 0) {
        multiplier = ikk / 100;
        ikkValue = region.ikk;
        regionName = region.name;
      }
    }
  }

  // Build breakdown
  type Row = {
    materialId: string;
    materialCode: string;
    materialName: string;
    materialType: string;
    unit: string;
    coefficient: number;
    qty: number; // koef × volume
    unitPrice: number; // harga base (sebelum IKK)
    unitPriceAdjusted: number; // harga × IKK
    lineTotal: number; // qty × unitPriceAdjusted
    priceMissing: boolean;
  };

  const rows: Row[] = [];
  let subtotal = 0;
  const missing: string[] = [];

  for (const comp of components) {
    const priceRows = await db
      .select({ price: schema.materialPrices.price })
      .from(schema.materialPrices)
      .where(
        and(
          eq(schema.materialPrices.materialId, comp.materialId),
          nationalId
            ? or(
                eq(schema.materialPrices.regionId, nationalId),
                isNull(schema.materialPrices.regionId),
              )
            : isNull(schema.materialPrices.regionId),
          lte(schema.materialPrices.validFrom, today),
          or(
            isNull(schema.materialPrices.validTo),
            gte(schema.materialPrices.validTo, today),
          ),
        ),
      )
      .orderBy(desc(schema.materialPrices.validFrom))
      .limit(1);

    const coef = Number(comp.coefficient);
    const qty = coef * volume;
    const baseUnitPrice = priceRows[0] ? Number(priceRows[0].price) : 0;
    const adjustedUnitPrice = baseUnitPrice * multiplier;
    const lineTotal = qty * adjustedUnitPrice;
    const priceMissing = !priceRows[0];

    rows.push({
      materialId: comp.materialId,
      materialCode: comp.materialCode,
      materialName: comp.materialName,
      materialType: comp.materialType,
      unit: comp.materialUnit,
      coefficient: coef,
      qty,
      unitPrice: baseUnitPrice,
      unitPriceAdjusted: adjustedUnitPrice,
      lineTotal,
      priceMissing,
    });

    if (priceMissing) missing.push(comp.materialName);
    else subtotal += lineTotal;
  }

  // Group by material type
  const byType = {
    bahan: rows.filter((r) => r.materialType === "bahan"),
    tenaga: rows.filter((r) => r.materialType === "tenaga"),
    alat: rows.filter((r) => r.materialType === "alat"),
  };

  return Response.json({
    ahsp: {
      id: ahsp.id,
      code: ahsp.code,
      name: ahsp.name,
      unit: ahsp.unit,
      sourceDoc: ahsp.sourceDoc,
    },
    volume,
    region: {
      id: regionId,
      name: regionName,
      ikk: ikkValue,
      multiplier,
    },
    components: rows,
    byType,
    subtotal,
    unitPrice: volume > 0 ? subtotal / volume : 0,
    missingMaterials: missing,
  });
}
