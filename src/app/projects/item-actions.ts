"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, lte, or, gte, desc } from "drizzle-orm";
import { db, schema } from "@/db";

const NUM_RE = /^\d+(\.\d+)?$/;

function parseNum(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const s = value.toString().trim();
  if (!s) return null;
  if (!NUM_RE.test(s)) return null;
  return s;
}

const NATIONAL_REGION_CODE = "ID";

/**
 * Hitung unit price dari AHSP item:
 *  sum atas komponen: koefisien * harga_terbaru_material
 * Harga prefer regionId match; fallback ke nasional (region NULL atau code "ID").
 *
 * Returns: { price: string, missingMaterials: string[] }
 * Kalau ada material tanpa harga, balikkin di missingMaterials supaya UI bisa
 * kasih warning.
 */
async function calculateAhspUnitPrice(
  ahspItemId: string,
): Promise<{ price: string; missingMaterials: string[] }> {
  const components = await db
    .select({
      coefficient: schema.ahspComponents.coefficient,
      materialId: schema.materials.id,
      materialName: schema.materials.name,
    })
    .from(schema.ahspComponents)
    .innerJoin(
      schema.materials,
      eq(schema.materials.id, schema.ahspComponents.materialId),
    )
    .where(eq(schema.ahspComponents.ahspItemId, ahspItemId));

  if (components.length === 0) {
    return { price: "0", missingMaterials: [] };
  }

  // Ambil region nasional (fallback)
  const nationalRegion = await db
    .select({ id: schema.regions.id })
    .from(schema.regions)
    .where(eq(schema.regions.code, NATIONAL_REGION_CODE))
    .limit(1);
  const nationalId = nationalRegion[0]?.id ?? null;

  let total = 0;
  const missing: string[] = [];
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  for (const comp of components) {
    // Try region nasional first; if none, try region NULL (default)
    const priceRow = await db
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

    if (!priceRow[0]) {
      missing.push(comp.materialName);
      continue;
    }

    const coef = Number(comp.coefficient);
    const price = Number(priceRow[0].price);
    if (Number.isFinite(coef) && Number.isFinite(price)) {
      total += coef * price;
    }
  }

  return { price: total.toFixed(2), missingMaterials: missing };
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export type CreateItemFormState = {
  error?: string;
  warning?: string;
  fieldErrors?: Partial<
    Record<"name" | "unit" | "volume" | "unitPrice" | "ahspItemId", string>
  >;
};

export async function createProjectItem(
  projectId: string,
  _prev: CreateItemFormState,
  formData: FormData,
): Promise<CreateItemFormState> {
  const wbsItemRaw = (formData.get("wbsItemId") ?? "").toString().trim();
  const wbsItemId = wbsItemRaw ? wbsItemRaw : null;
  const mode = (formData.get("mode") ?? "custom").toString();
  const volume = parseNum(formData.get("volume"));

  if (!volume) {
    return { fieldErrors: { volume: "Volume harus angka positif." } };
  }

  // ─── AHSP mode ────────────────────────────────────────────────────────────
  if (mode === "ahsp") {
    const ahspItemId = (formData.get("ahspItemId") ?? "").toString().trim();
    if (!ahspItemId) {
      return {
        fieldErrors: { ahspItemId: "Pilih AHSP dari dropdown." },
      };
    }

    // Snapshot: ambil AHSP master, hitung harga, simpan ke custom_* sebagai
    // freeze. Master changes nanti gak propagate (audit-safe).
    const ahsp = await db
      .select({
        name: schema.ahspItems.name,
        unit: schema.ahspItems.unit,
      })
      .from(schema.ahspItems)
      .where(eq(schema.ahspItems.id, ahspItemId))
      .limit(1);

    if (!ahsp[0]) {
      return { fieldErrors: { ahspItemId: "AHSP tidak ditemukan." } };
    }

    const { price, missingMaterials } =
      await calculateAhspUnitPrice(ahspItemId);

    try {
      await db.insert(schema.projectItems).values({
        projectId,
        wbsItemId,
        ahspItemId,
        customName: ahsp[0].name,
        customUnit: ahsp[0].unit,
        customUnitPrice: price,
        volume: volume,
        sortOrder: 0,
      });
    } catch (e) {
      return {
        error:
          e instanceof Error ? `Gagal simpan: ${e.message}` : "Gagal simpan.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    if (missingMaterials.length > 0) {
      return {
        warning: `Item disimpan, tapi ${missingMaterials.length} material belum ada harga: ${missingMaterials.join(", ")}. Harga AHSP under-estimated.`,
      };
    }
    return {};
  }

  // ─── Custom mode ──────────────────────────────────────────────────────────
  const customName = (formData.get("name") ?? "").toString().trim();
  const customUnit = (formData.get("unit") ?? "").toString().trim();
  const customUnitPrice = parseNum(formData.get("unitPrice"));

  const fieldErrors: NonNullable<CreateItemFormState["fieldErrors"]> = {};
  if (!customName) fieldErrors.name = "Nama pekerjaan wajib diisi.";
  else if (customName.length > 200)
    fieldErrors.name = "Maksimal 200 karakter.";
  if (!customUnit) fieldErrors.unit = "Satuan wajib diisi (mis. m3, m2, kg).";
  if (!customUnitPrice)
    fieldErrors.unitPrice = "Harga satuan harus angka positif.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  try {
    await db.insert(schema.projectItems).values({
      projectId,
      wbsItemId,
      ahspItemId: null,
      customName,
      customUnit,
      customUnitPrice: customUnitPrice!,
      volume: volume,
      sortOrder: 0,
    });
  } catch (e) {
    return {
      error: e instanceof Error ? `Gagal simpan: ${e.message}` : "Gagal simpan.",
    };
  }

  revalidatePath(`/projects/${projectId}`);
  return {};
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export type UpdateItemFormState = CreateItemFormState;

export async function updateProjectItem(
  itemId: string,
  projectId: string,
  _prev: UpdateItemFormState,
  formData: FormData,
): Promise<UpdateItemFormState> {
  const wbsItemRaw = (formData.get("wbsItemId") ?? "").toString().trim();
  const wbsItemId = wbsItemRaw ? wbsItemRaw : null;
  const customName = (formData.get("name") ?? "").toString().trim();
  const customUnit = (formData.get("unit") ?? "").toString().trim();
  const volume = parseNum(formData.get("volume"));
  const customUnitPrice = parseNum(formData.get("unitPrice"));

  const fieldErrors: NonNullable<UpdateItemFormState["fieldErrors"]> = {};
  if (!customName) fieldErrors.name = "Nama pekerjaan wajib diisi.";
  else if (customName.length > 200)
    fieldErrors.name = "Maksimal 200 karakter.";
  if (!customUnit) fieldErrors.unit = "Satuan wajib diisi.";
  if (!volume) fieldErrors.volume = "Volume harus angka positif.";
  if (!customUnitPrice)
    fieldErrors.unitPrice = "Harga satuan harus angka positif.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  try {
    await db
      .update(schema.projectItems)
      .set({
        wbsItemId,
        customName,
        customUnit,
        customUnitPrice: customUnitPrice!,
        volume: volume!,
        updatedAt: new Date(),
      })
      .where(eq(schema.projectItems.id, itemId));
  } catch (e) {
    return {
      error: e instanceof Error ? `Gagal simpan: ${e.message}` : "Gagal simpan.",
    };
  }

  revalidatePath(`/projects/${projectId}`);
  return {};
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deleteProjectItem(formData: FormData) {
  const id = (formData.get("id") ?? "").toString();
  const projectId = (formData.get("projectId") ?? "").toString();
  if (!id || !projectId) {
    throw new Error("Item ID atau project ID hilang.");
  }
  await db.delete(schema.projectItems).where(eq(schema.projectItems.id, id));
  revalidatePath(`/projects/${projectId}`);
}
