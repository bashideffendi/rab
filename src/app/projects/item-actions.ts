"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, lte, or, gte, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, verifyProjectOwnership } from "@/lib/auth";
import { normalizeUnit } from "@/lib/units";

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
 *  base = sum atas komponen: koefisien × harga_terbaru_material
 *  final = base × (region.ikk / 100) kalau projectRegionId dan region.ikk ada,
 *          else fallback × 1 (= nasional).
 *
 * Returns: { price: string, missingMaterials: string[], multiplier: number }
 */
async function calculateAhspUnitPrice(
  ahspItemId: string,
  projectRegionId: string | null,
): Promise<{
  price: string;
  missingMaterials: string[];
  multiplier: number;
}> {
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
    return { price: "0", missingMaterials: [], multiplier: 1 };
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

  // Apply IKK multiplier kalau project punya region yang udah ada IKK-nya.
  let multiplier = 1;
  if (projectRegionId) {
    const region = await db
      .select({ ikk: schema.regions.ikk })
      .from(schema.regions)
      .where(eq(schema.regions.id, projectRegionId))
      .limit(1);
    if (region[0]?.ikk) {
      const ikkNum = Number(region[0].ikk);
      if (Number.isFinite(ikkNum) && ikkNum > 0) {
        multiplier = ikkNum / 100;
      }
    }
  }

  total = total * multiplier;
  return { price: total.toFixed(2), missingMaterials: missing, multiplier };
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export type CreateItemFormState = {
  error?: string;
  warning?: string;
  fieldErrors?: Partial<
    Record<"name" | "unit" | "volume" | "unitPrice" | "ahspItemId", string>
  >;
  /** Preserve user input on validation error */
  values?: {
    mode: string;
    wbsItemId: string;
    ahspItemId: string;
    name: string;
    unit: string;
    volume: string;
    unitPrice: string;
    notes: string;
  };
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
  const volumeRaw = (formData.get("volume") ?? "").toString().trim();
  const ahspItemIdRaw = (formData.get("ahspItemId") ?? "").toString().trim();
  const nameRaw = (formData.get("name") ?? "").toString().trim();
  const unitRaw = normalizeUnit(
    (formData.get("unit") ?? "").toString(),
  );
  const unitPriceRaw = (formData.get("unitPrice") ?? "").toString().trim();

  // Volume calculator fields (Phase 7)
  const calculatorTypeRaw = (formData.get("calculatorType") ?? "")
    .toString()
    .trim();
  const calculatorType = calculatorTypeRaw || null;
  const calculatorInputsRaw = (formData.get("calculatorInputs") ?? "")
    .toString()
    .trim();
  let calculatorInputs: Record<string, number> | null = null;
  if (calculatorInputsRaw) {
    try {
      const parsed = JSON.parse(calculatorInputsRaw);
      if (parsed && typeof parsed === "object") calculatorInputs = parsed;
    } catch {
      // ignore — silakan submit tanpa breakdown
    }
  }
  const volumeFormulaRaw = (formData.get("volumeFormula") ?? "")
    .toString()
    .trim();
  const volumeFormula = volumeFormulaRaw || null;

  const notesRaw = (formData.get("notes") ?? "").toString();
  const notes = notesRaw.trim() ? notesRaw : null;

  // Snapshot all input — di-attach ke return state kalau error, biar form gak ke-reset
  const inputValues = {
    mode,
    wbsItemId: wbsItemRaw,
    ahspItemId: ahspItemIdRaw,
    name: nameRaw,
    unit: unitRaw,
    volume: volumeRaw,
    unitPrice: unitPriceRaw,
    notes: notesRaw,
  };

  if (!volume) {
    return {
      fieldErrors: { volume: "Volume harus angka positif." },
      values: inputValues,
    };
  }

  const user = await requireUser();
  try {
    await verifyProjectOwnership(projectId, user.id);
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Gak punya akses ke project ini.",
      values: inputValues,
    };
  }

  // ─── AHSP mode ────────────────────────────────────────────────────────────
  if (mode === "ahsp") {
    const ahspItemId = ahspItemIdRaw;
    if (!ahspItemId) {
      return {
        fieldErrors: { ahspItemId: "Pilih AHSP dari dropdown." },
        values: inputValues,
      };
    }

    // Snapshot: ambil AHSP master, hitung harga (dengan IKK regional kalau
    // project punya region), simpan ke custom_* sebagai freeze. Master
    // changes nanti gak propagate (audit-safe).
    const ahsp = await db
      .select({
        name: schema.ahspItems.name,
        unit: schema.ahspItems.unit,
      })
      .from(schema.ahspItems)
      .where(eq(schema.ahspItems.id, ahspItemId))
      .limit(1);

    if (!ahsp[0]) {
      return {
        fieldErrors: { ahspItemId: "AHSP tidak ditemukan." },
        values: inputValues,
      };
    }

    // Get project's regionId untuk IKK multiplier
    const projectRow = await db
      .select({ regionId: schema.projects.regionId })
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1);

    const { price, missingMaterials } = await calculateAhspUnitPrice(
      ahspItemId,
      projectRow[0]?.regionId ?? null,
    );

    try {
      await db.insert(schema.projectItems).values({
        projectId,
        wbsItemId,
        ahspItemId,
        customName: ahsp[0].name,
        customUnit: ahsp[0].unit,
        customUnitPrice: price,
        volume: volume,
        calculatorType,
        calculatorInputs,
        volumeFormula,
        notes,
        sortOrder: 0,
      });
    } catch (e) {
      return {
        error:
          e instanceof Error ? `Gagal simpan: ${e.message}` : "Gagal simpan.",
        values: inputValues,
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
  const customName = nameRaw;
  const customUnit = unitRaw;
  const customUnitPrice = parseNum(formData.get("unitPrice"));

  const fieldErrors: NonNullable<CreateItemFormState["fieldErrors"]> = {};
  if (!customName) fieldErrors.name = "Nama pekerjaan wajib diisi.";
  else if (customName.length > 200)
    fieldErrors.name = "Maksimal 200 karakter.";
  if (!customUnit) fieldErrors.unit = "Satuan wajib diisi (mis. m3, m2, kg).";
  if (!customUnitPrice)
    fieldErrors.unitPrice = "Harga satuan harus angka positif.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values: inputValues };
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
      calculatorType,
      calculatorInputs,
      volumeFormula,
      notes,
      sortOrder: 0,
    });
  } catch (e) {
    return {
      error: e instanceof Error ? `Gagal simpan: ${e.message}` : "Gagal simpan.",
      values: inputValues,
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
  const customUnit = normalizeUnit(
    (formData.get("unit") ?? "").toString(),
  );
  const volume = parseNum(formData.get("volume"));
  const customUnitPrice = parseNum(formData.get("unitPrice"));

  // Volume calculator fields (parse + save sehingga edit form bisa preserve)
  const calculatorTypeRaw = (formData.get("calculatorType") ?? "")
    .toString()
    .trim();
  const calculatorType = calculatorTypeRaw || null;
  const calculatorInputsRaw = (formData.get("calculatorInputs") ?? "")
    .toString()
    .trim();
  let calculatorInputs: Record<string, number> | null = null;
  if (calculatorInputsRaw) {
    try {
      const parsed = JSON.parse(calculatorInputsRaw);
      if (parsed && typeof parsed === "object") calculatorInputs = parsed;
    } catch {
      // ignore — submit tanpa breakdown
    }
  }
  const volumeFormulaRaw = (formData.get("volumeFormula") ?? "")
    .toString()
    .trim();
  const volumeFormula = volumeFormulaRaw || null;

  const notesRaw = (formData.get("notes") ?? "").toString();
  const notes = notesRaw.trim() ? notesRaw : null;

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

  const user = await requireUser();
  try {
    await verifyProjectOwnership(projectId, user.id);
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Gak punya akses ke project ini.",
    };
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
        calculatorType,
        calculatorInputs,
        volumeFormula,
        notes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.projectItems.id, itemId),
          eq(schema.projectItems.projectId, projectId),
        ),
      );
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
  const user = await requireUser();
  await verifyProjectOwnership(projectId, user.id);
  await db
    .delete(schema.projectItems)
    .where(
      and(
        eq(schema.projectItems.id, id),
        eq(schema.projectItems.projectId, projectId),
      ),
    );
  revalidatePath(`/projects/${projectId}`);
}
