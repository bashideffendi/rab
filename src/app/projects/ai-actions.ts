"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, verifyProjectOwnership } from "@/lib/auth";

/**
 * Apply approved AI-extracted items ke project.
 * Input via FormData:
 *  - projectId
 *  - payload (JSON string): { wbs: [{ code, name, items: [{ name, unit, volume, ahspId? }] }] }
 *
 * Logic:
 *  1. Insert WBS items hierarchical (auto-derive level + parent dari code)
 *  2. Untuk tiap item: kalau ahspId ada → snapshot dari AHSP (mode AHSP),
 *     kalau gak → insert custom item (mode Custom)
 *  3. Skip item dengan volume <= 0 atau name kosong (didn't approved)
 */

type ApplyItem = {
  name: string;
  unit: string;
  volume: number;
  ahspId?: string;
};

type ApplyWbs = {
  code: string;
  name: string;
  items: ApplyItem[];
};

type ApplyPayload = {
  wbs: ApplyWbs[];
};

function parseWbsCode(code: string) {
  const parts = code.split(".");
  return {
    level: parts.length - 1,
    parentCode: parts.length > 1 ? parts.slice(0, -1).join(".") : null,
  };
}

export async function applyAiExtraction(formData: FormData) {
  const projectId = (formData.get("projectId") ?? "").toString();
  const payloadStr = (formData.get("payload") ?? "").toString();

  if (!projectId || !payloadStr) {
    throw new Error("projectId atau payload hilang.");
  }

  const user = await requireUser();
  await verifyProjectOwnership(projectId, user.id);

  let payload: ApplyPayload;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    throw new Error("Payload JSON gak valid.");
  }
  if (!Array.isArray(payload.wbs) || payload.wbs.length === 0) {
    throw new Error("Tidak ada item yang ke-approve.");
  }

  // Existing WBS map (kalau project udah ada WBS, hindari duplikat code)
  const existingWbs = await db
    .select({ id: schema.wbsItems.id, code: schema.wbsItems.code })
    .from(schema.wbsItems)
    .where(eq(schema.wbsItems.projectId, projectId));
  const wbsByCode = new Map<string, string>();
  for (const w of existingWbs) wbsByCode.set(w.code, w.id);

  // Sort WBS by code natural order untuk insert parent-first
  const sortedWbs = [...payload.wbs].sort((a, b) => {
    const ap = a.code.split(".").map(Number);
    const bp = b.code.split(".").map(Number);
    const len = Math.max(ap.length, bp.length);
    for (let i = 0; i < len; i++) {
      const av = ap[i] ?? 0;
      const bv = bp[i] ?? 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  });

  // Sort order untuk new WBS items
  let wbsSortOrder = existingWbs.length;
  let itemSortOrder = 0;

  for (const w of sortedWbs) {
    let wbsId = wbsByCode.get(w.code);
    if (!wbsId) {
      const { level, parentCode } = parseWbsCode(w.code);
      const parentId = parentCode ? wbsByCode.get(parentCode) ?? null : null;
      const [inserted] = await db
        .insert(schema.wbsItems)
        .values({
          projectId,
          parentId,
          code: w.code,
          name: w.name,
          level,
          sortOrder: wbsSortOrder++,
        })
        .returning({ id: schema.wbsItems.id });
      wbsId = inserted.id;
      wbsByCode.set(w.code, wbsId);
    }

    // Insert items
    for (const it of w.items) {
      if (!it.name || it.volume <= 0) continue;

      if (it.ahspId) {
        // AHSP mode — fetch AHSP master + recalc price (region-aware)
        const ahsp = await db
          .select({
            name: schema.ahspItems.name,
            unit: schema.ahspItems.unit,
          })
          .from(schema.ahspItems)
          .where(eq(schema.ahspItems.id, it.ahspId))
          .limit(1);
        if (!ahsp[0]) continue;

        // Compute price (basic — fetch first valid price per material)
        // Reuse logic minimal from item-actions (skip IKK for v1 of AI flow)
        const components = await db
          .select({
            materialId: schema.materials.id,
            coefficient: schema.ahspComponents.coefficient,
          })
          .from(schema.ahspComponents)
          .innerJoin(
            schema.materials,
            eq(schema.materials.id, schema.ahspComponents.materialId),
          )
          .where(eq(schema.ahspComponents.ahspItemId, it.ahspId));

        let basePrice = 0;
        for (const comp of components) {
          const priceRow = await db
            .select({ price: schema.materialPrices.price })
            .from(schema.materialPrices)
            .where(eq(schema.materialPrices.materialId, comp.materialId))
            .orderBy(asc(schema.materialPrices.validFrom))
            .limit(1);
          if (priceRow[0]) {
            basePrice += Number(priceRow[0].price) * Number(comp.coefficient);
          }
        }

        await db.insert(schema.projectItems).values({
          projectId,
          wbsItemId: wbsId,
          ahspItemId: it.ahspId,
          customName: ahsp[0].name,
          customUnit: ahsp[0].unit,
          customUnitPrice: basePrice.toFixed(2),
          volume: it.volume.toString(),
          sortOrder: itemSortOrder++,
        });
      } else {
        // Custom item — no AHSP, no price (user akan isi manual)
        await db.insert(schema.projectItems).values({
          projectId,
          wbsItemId: wbsId,
          ahspItemId: null,
          customName: it.name,
          customUnit: it.unit,
          customUnitPrice: "0",
          volume: it.volume.toString(),
          sortOrder: itemSortOrder++,
        });
      }
    }
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
