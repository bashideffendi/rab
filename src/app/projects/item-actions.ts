"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const NUM_RE = /^\d+(\.\d+)?$/;

function parseNum(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const s = value.toString().trim();
  if (!s) return null;
  if (!NUM_RE.test(s)) return null;
  return s;
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export type CreateItemFormState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"name" | "unit" | "volume" | "unitPrice", string>
  >;
};

export async function createProjectItem(
  projectId: string,
  _prev: CreateItemFormState,
  formData: FormData,
): Promise<CreateItemFormState> {
  const wbsItemRaw = (formData.get("wbsItemId") ?? "").toString().trim();
  const wbsItemId = wbsItemRaw ? wbsItemRaw : null;
  const customName = (formData.get("name") ?? "").toString().trim();
  const customUnit = (formData.get("unit") ?? "").toString().trim();
  const volume = parseNum(formData.get("volume"));
  const customUnitPrice = parseNum(formData.get("unitPrice"));

  const fieldErrors: NonNullable<CreateItemFormState["fieldErrors"]> = {};
  if (!customName) fieldErrors.name = "Nama pekerjaan wajib diisi.";
  else if (customName.length > 200)
    fieldErrors.name = "Maksimal 200 karakter.";
  if (!customUnit) fieldErrors.unit = "Satuan wajib diisi (mis. m3, m2, kg).";
  if (!volume) fieldErrors.volume = "Volume harus angka positif.";
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
      volume: volume!,
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
