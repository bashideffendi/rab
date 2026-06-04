"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { computeAhspPrices } from "@/lib/pricing";

/**
 * Clone template ke project baru milik user.
 * Logic:
 *  1. Load template (is_template = true) by slug
 *  2. Buat new project, user_id = current user, is_template = false,
 *     copy name + notes dari template, regionId NULL (user edit nanti)
 *  3. Clone WBS items, mapping old id → new id supaya parent links benar
 *  4. Clone project_items, mapping wbs_item_id pakai map baru. Untuk setiap
 *     item AHSP, RECALC price pakai project region (NULL = nasional × 1)
 *     dan snapshot ke customName/customUnit/customUnitPrice (audit-safe).
 */
export async function cloneTemplate(formData: FormData) {
  const slug = (formData.get("slug") ?? "").toString().trim();
  if (!slug) {
    throw new Error("Template slug hilang.");
  }

  const user = await requireUser();

  // 1. Load template
  const templateRows = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.isTemplate, true),
        eq(schema.projects.templateSlug, slug),
      ),
    )
    .limit(1);

  const template = templateRows[0];
  if (!template) {
    throw new Error(`Template "${slug}" gak ditemukan.`);
  }

  // 2. Buat project baru
  const [newProject] = await db
    .insert(schema.projects)
    .values({
      userId: user.id,
      name: template.name,
      notes: template.notes,
      status: "draft",
      isTemplate: false,
      // regionId, opd, ownerName tetap NULL — user fill nanti
    })
    .returning({ id: schema.projects.id });

  // 3. Clone WBS items, build oldId → newId map
  const templateWbs = await db
    .select()
    .from(schema.wbsItems)
    .where(eq(schema.wbsItems.projectId, template.id))
    .orderBy(asc(schema.wbsItems.sortOrder));

  const wbsIdMap = new Map<string, string>();
  for (const w of templateWbs) {
    const [newWbs] = await db
      .insert(schema.wbsItems)
      .values({
        projectId: newProject.id,
        parentId: w.parentId ? wbsIdMap.get(w.parentId) ?? null : null,
        code: w.code,
        name: w.name,
        level: w.level,
        sortOrder: w.sortOrder,
      })
      .returning({ id: schema.wbsItems.id });
    wbsIdMap.set(w.id, newWbs.id);
  }

  // 4. Clone project items, recalc AHSP prices
  const templateItems = await db
    .select()
    .from(schema.projectItems)
    .where(eq(schema.projectItems.projectId, template.id))
    .orderBy(asc(schema.projectItems.sortOrder));

  // Recompute harga AHSP via lib/pricing (region NULL = nasional, IKK 1).
  const tplAhspIds = [
    ...new Set(
      templateItems.map((it) => it.ahspItemId).filter((x): x is string => !!x),
    ),
  ];
  const tplAhspPrices = await computeAhspPrices(tplAhspIds, null);

  for (const it of templateItems) {
    let customName = it.customName;
    let customUnit = it.customUnit;
    let customUnitPrice = it.customUnitPrice;

    // Kalau item AHSP-based, ambil snapshot baru dari AHSP master + region calc
    if (it.ahspItemId) {
      const ahspRows = await db
        .select({
          name: schema.ahspItems.name,
          unit: schema.ahspItems.unit,
        })
        .from(schema.ahspItems)
        .where(eq(schema.ahspItems.id, it.ahspItemId))
        .limit(1);

      if (ahspRows[0]) {
        customName = ahspRows[0].name;
        customUnit = ahspRows[0].unit;
        customUnitPrice = tplAhspPrices.get(it.ahspItemId)?.price ?? "0";
      }
    }

    await db.insert(schema.projectItems).values({
      projectId: newProject.id,
      wbsItemId: it.wbsItemId ? wbsIdMap.get(it.wbsItemId) ?? null : null,
      ahspItemId: it.ahspItemId,
      customName,
      customUnit,
      customUnitPrice,
      volume: it.volume,
      sortOrder: it.sortOrder,
    });
  }

  revalidatePath("/projects");
  redirect(`/projects/${newProject.id}`);
}

// Harga AHSP kini via computeAhspPrices (lib/pricing) — fix bug ASC harga tertua.
