"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";

const PROJECT_STATUSES = ["draft", "active", "archived"] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

function isProjectStatus(v: unknown): v is ProjectStatus {
  return (
    typeof v === "string" &&
    (PROJECT_STATUSES as readonly string[]).includes(v)
  );
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export type CreateProjectFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name", string>>;
};

function parsePercent(v: FormDataEntryValue | null, fallback: string): string {
  if (v == null) return fallback;
  const s = v.toString().trim();
  if (!s) return fallback;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return n.toFixed(2);
}

function parseInt0OrPositive(
  v: FormDataEntryValue | null,
  fallback: number,
): number {
  if (v == null) return fallback;
  const s = v.toString().trim();
  if (!s) return fallback;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) return fallback;
  return n;
}

export async function createProject(
  _prev: CreateProjectFormState,
  formData: FormData,
): Promise<CreateProjectFormState> {
  const name = (formData.get("name") ?? "").toString().trim();
  const opd = (formData.get("opd") ?? "").toString().trim() || null;
  const ownerName =
    (formData.get("ownerName") ?? "").toString().trim() || null;
  const notes = (formData.get("notes") ?? "").toString().trim() || null;
  const regionRaw = (formData.get("regionId") ?? "").toString().trim();
  const regionId = regionRaw ? regionRaw : null;
  const alamat = (formData.get("alamat") ?? "").toString().trim() || null;
  const tahunRaw = (formData.get("tahun") ?? "").toString().trim();
  const tahun = tahunRaw ? Number(tahunRaw) : null;
  const ppnPercent = parsePercent(formData.get("ppnPercent"), "11.00");
  const overheadPercent = parsePercent(
    formData.get("overheadPercent"),
    "0.00",
  );
  const dibulatkanKe = parseInt0OrPositive(formData.get("dibulatkanKe"), 1000);

  if (!name) {
    return { fieldErrors: { name: "Nama project wajib diisi." } };
  }
  if (name.length > 200) {
    return { fieldErrors: { name: "Nama project maksimal 200 karakter." } };
  }

  const user = await requireUser();

  let inserted: { id: string } | undefined;
  try {
    const rows = await db
      .insert(schema.projects)
      .values({
        userId: user.id,
        name,
        opd,
        ownerName,
        notes,
        regionId,
        alamat,
        tahun,
        ppnPercent,
        overheadPercent,
        dibulatkanKe,
      })
      .returning({ id: schema.projects.id });
    inserted = rows[0];
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Gagal simpan: ${e.message}`
          : "Gagal simpan project.",
    };
  }

  revalidatePath("/projects");
  redirect(`/projects/${inserted!.id}`);
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export type UpdateProjectFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "status", string>>;
};

export async function updateProject(
  id: string,
  _prev: UpdateProjectFormState,
  formData: FormData,
): Promise<UpdateProjectFormState> {
  const name = (formData.get("name") ?? "").toString().trim();
  const opd = (formData.get("opd") ?? "").toString().trim() || null;
  const ownerName =
    (formData.get("ownerName") ?? "").toString().trim() || null;
  const notes = (formData.get("notes") ?? "").toString().trim() || null;
  const status = formData.get("status");
  const regionRaw = (formData.get("regionId") ?? "").toString().trim();
  const regionId = regionRaw ? regionRaw : null;
  const alamat = (formData.get("alamat") ?? "").toString().trim() || null;
  const tahunRaw = (formData.get("tahun") ?? "").toString().trim();
  const tahun = tahunRaw ? Number(tahunRaw) : null;
  const ppnPercent = parsePercent(formData.get("ppnPercent"), "11.00");
  const overheadPercent = parsePercent(
    formData.get("overheadPercent"),
    "0.00",
  );
  const dibulatkanKe = parseInt0OrPositive(formData.get("dibulatkanKe"), 1000);

  if (!name) {
    return { fieldErrors: { name: "Nama project wajib diisi." } };
  }
  if (name.length > 200) {
    return { fieldErrors: { name: "Nama project maksimal 200 karakter." } };
  }
  if (!isProjectStatus(status)) {
    return { fieldErrors: { status: "Status tidak valid." } };
  }

  const user = await requireUser();

  try {
    await db
      .update(schema.projects)
      .set({
        name,
        opd,
        ownerName,
        notes,
        status,
        regionId,
        alamat,
        tahun,
        ppnPercent,
        overheadPercent,
        dibulatkanKe,
        updatedAt: new Date(),
      })
      .where(
        and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)),
      );
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Gagal simpan: ${e.message}`
          : "Gagal simpan perubahan.",
    };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

/**
 * Duplicate project: copy project + WBS + items dengan recalc AHSP price
 * (sama logic dengan cloneTemplate tapi source-nya project user sendiri).
 */
export async function duplicateProject(formData: FormData) {
  const id = (formData.get("id") ?? "").toString();
  if (!id) throw new Error("Project ID hilang.");
  const user = await requireUser();

  // Load source project
  const sourceRows = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)))
    .limit(1);
  const source = sourceRows[0];
  if (!source) throw new Error("Project gak ditemukan.");

  // Insert new project
  const [newProj] = await db
    .insert(schema.projects)
    .values({
      userId: user.id,
      name: `${source.name} (Copy)`,
      opd: source.opd,
      ownerName: source.ownerName,
      regionId: source.regionId,
      status: "draft",
      notes: source.notes,
      tahun: source.tahun,
      alamat: source.alamat,
      ppnPercent: source.ppnPercent,
      overheadPercent: source.overheadPercent,
      dibulatkanKe: source.dibulatkanKe,
      isTemplate: false,
    })
    .returning({ id: schema.projects.id });

  // Clone WBS
  const wbs = await db
    .select()
    .from(schema.wbsItems)
    .where(eq(schema.wbsItems.projectId, source.id));
  const wbsIdMap = new Map<string, string>();
  for (const w of wbs) {
    const [nw] = await db
      .insert(schema.wbsItems)
      .values({
        projectId: newProj.id,
        parentId: w.parentId ? wbsIdMap.get(w.parentId) ?? null : null,
        code: w.code,
        name: w.name,
        level: w.level,
        sortOrder: w.sortOrder,
      })
      .returning({ id: schema.wbsItems.id });
    wbsIdMap.set(w.id, nw.id);
  }

  // Clone items (preserve snapshot, gak recalc — copy as-is)
  const items = await db
    .select()
    .from(schema.projectItems)
    .where(eq(schema.projectItems.projectId, source.id));
  for (const it of items) {
    await db.insert(schema.projectItems).values({
      projectId: newProj.id,
      wbsItemId: it.wbsItemId ? wbsIdMap.get(it.wbsItemId) ?? null : null,
      ahspItemId: it.ahspItemId,
      customName: it.customName,
      customUnit: it.customUnit,
      customUnitPrice: it.customUnitPrice,
      volume: it.volume,
      sortOrder: it.sortOrder,
    });
  }

  revalidatePath("/projects");
  redirect(`/projects/${newProj.id}`);
}

/**
 * Toggle archive flag.
 */
export async function toggleArchiveProject(formData: FormData) {
  const id = (formData.get("id") ?? "").toString();
  const archive = (formData.get("archive") ?? "true").toString() === "true";
  if (!id) throw new Error("Project ID hilang.");
  const user = await requireUser();
  await db
    .update(schema.projects)
    .set({ isArchived: archive, updatedAt: new Date() })
    .where(
      and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)),
    );
  revalidatePath("/projects");
  if (archive) redirect("/projects");
  redirect(`/projects/${id}`);
}

export async function deleteProject(formData: FormData) {
  const id = (formData.get("id") ?? "").toString();
  if (!id) {
    throw new Error("Project ID hilang.");
  }
  const user = await requireUser();
  await db
    .delete(schema.projects)
    .where(
      and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)),
    );
  revalidatePath("/projects");
  redirect("/projects");
}
