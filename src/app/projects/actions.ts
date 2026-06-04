"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, assertNotLocked } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isProgressPeriod, type ProgressPeriod } from "@/lib/period";
import { computeRekap } from "@/lib/rekap";

const PROJECT_STATUSES = ["draft", "active", "archived"] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

function isProjectStatus(v: unknown): v is ProjectStatus {
  return (
    typeof v === "string" &&
    (PROJECT_STATUSES as readonly string[]).includes(v)
  );
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

type ProjectField =
  | "name"
  | "regionId"
  | "opd"
  | "ownerName"
  | "tahun"
  | "alamat"
  | "projectType"
  | "luasTanah"
  | "luasBangunan"
  | "startedAt"
  | "progressPeriod";

function parseProgressPeriod(
  v: FormDataEntryValue | null,
  fallback: ProgressPeriod = "weekly",
): ProgressPeriod {
  if (v == null) return fallback;
  const s = v.toString().trim();
  return isProgressPeriod(s) ? s : fallback;
}

export type CreateProjectFormState = {
  error?: string;
  fieldErrors?: Partial<Record<ProjectField, string>>;
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

function parseCoord(
  v: FormDataEntryValue | null,
  min: number,
  max: number,
): string | null {
  if (v == null) return null;
  const s = v.toString().trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n.toFixed(7);
}

function parseDateOrNull(v: FormDataEntryValue | null): {
  value: string | null;
  invalid: boolean;
} {
  if (v == null) return { value: null, invalid: false };
  const s = v.toString().trim();
  if (!s) return { value: null, invalid: false };
  // Format expected: YYYY-MM-DD (HTML date input).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { value: null, invalid: true };
  }
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { value: null, invalid: true };
  }
  return { value: s, invalid: false };
}

function parseLuas(v: FormDataEntryValue | null): {
  value: string | null;
  invalid: boolean;
} {
  if (v == null) return { value: null, invalid: false };
  const s = v.toString().trim();
  if (!s) return { value: null, invalid: false };
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
    return { value: null, invalid: true };
  }
  return { value: n.toFixed(2), invalid: false };
}

export async function createProject(
  _prev: CreateProjectFormState,
  formData: FormData,
): Promise<CreateProjectFormState> {
  const name = (formData.get("name") ?? "").toString().trim();
  const opd = (formData.get("opd") ?? "").toString().trim();
  const ownerName = (formData.get("ownerName") ?? "").toString().trim();
  const notes = (formData.get("notes") ?? "").toString().trim() || null;
  const regionId = (formData.get("regionId") ?? "").toString().trim();
  const alamat = (formData.get("alamat") ?? "").toString().trim();
  const lat = parseCoord(formData.get("lat"), -90, 90);
  const lng = parseCoord(formData.get("lng"), -180, 180);
  const projectType = (formData.get("projectType") ?? "").toString().trim();
  const luasTanahParsed = parseLuas(formData.get("luasTanah"));
  const luasBangunanParsed = parseLuas(formData.get("luasBangunan"));
  const tahunRaw = (formData.get("tahun") ?? "").toString().trim();
  const tahunNum = tahunRaw ? Number(tahunRaw) : NaN;
  const ppnPercent = parsePercent(formData.get("ppnPercent"), "11.00");
  const overheadPercent = parsePercent(
    formData.get("overheadPercent"),
    "10.00",
  );
  const dibulatkanKe = parseInt0OrPositive(formData.get("dibulatkanKe"), 1000);
  const smkkPercent = parsePercent(formData.get("smkkPercent"), "1.50");
  const progressPeriod = parseProgressPeriod(formData.get("progressPeriod"));

  const fieldErrors: Partial<Record<ProjectField, string>> = {};
  if (!name) fieldErrors.name = "Nama project wajib diisi.";
  else if (name.length > 200)
    fieldErrors.name = "Nama project maksimal 200 karakter.";

  if (!regionId)
    fieldErrors.regionId =
      "Lokasi wajib dipilih — IKK provinsi mempengaruhi harga material.";

  if (!projectType) fieldErrors.projectType = "Jenis project wajib dipilih.";

  if (!opd) fieldErrors.opd = "Klien / pemilik proyek wajib diisi.";
  else if (opd.length > 200)
    fieldErrors.opd = "Klien maksimal 200 karakter.";

  if (!ownerName) fieldErrors.ownerName = "Penanggung jawab wajib diisi.";
  else if (ownerName.length > 200)
    fieldErrors.ownerName = "Penanggung jawab maksimal 200 karakter.";

  if (!tahunRaw) fieldErrors.tahun = "Tahun proyek wajib diisi.";
  else if (
    !Number.isInteger(tahunNum) ||
    tahunNum < 1990 ||
    tahunNum > 2100
  )
    fieldErrors.tahun = "Tahun harus angka antara 1990 - 2100.";

  if (!alamat) fieldErrors.alamat = "Alamat lengkap wajib diisi.";
  else if (alamat.length > 300)
    fieldErrors.alamat = "Alamat maksimal 300 karakter.";

  if (luasTanahParsed.invalid)
    fieldErrors.luasTanah = "Luas tanah tidak valid (angka 0 - 10.000.000 m²).";
  if (luasBangunanParsed.invalid)
    fieldErrors.luasBangunan =
      "Luas bangunan tidak valid (angka 0 - 10.000.000 m²).";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }
  const tahun = tahunNum;

  const user = await requireUser();
  const startedAtParsed = parseDateOrNull(formData.get("startedAt"));

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
        lat,
        lng,
        projectType,
        luasTanah: luasTanahParsed.value,
        luasBangunan: luasBangunanParsed.value,
        tahun,
        startedAt: startedAtParsed.value,
        ppnPercent,
        overheadPercent,
        smkkPercent,
        dibulatkanKe,
        progressPeriod,
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

  await logAudit({
    projectId: inserted!.id,
    userId: user.id,
    action: "create",
    summary: `Project "${name}" dibuat`,
  });

  revalidatePath("/projects");
  redirect(`/projects/${inserted!.id}`);
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

type UpdateField = ProjectField | "status";

export type UpdateProjectFormState = {
  error?: string;
  fieldErrors?: Partial<Record<UpdateField, string>>;
};

export async function updateProject(
  id: string,
  _prev: UpdateProjectFormState,
  formData: FormData,
): Promise<UpdateProjectFormState> {
  const name = (formData.get("name") ?? "").toString().trim();
  const opd = (formData.get("opd") ?? "").toString().trim();
  const ownerName = (formData.get("ownerName") ?? "").toString().trim();
  const notes = (formData.get("notes") ?? "").toString().trim() || null;
  const status = formData.get("status");
  const regionId = (formData.get("regionId") ?? "").toString().trim();
  const alamat = (formData.get("alamat") ?? "").toString().trim();
  const lat = parseCoord(formData.get("lat"), -90, 90);
  const lng = parseCoord(formData.get("lng"), -180, 180);
  const projectType = (formData.get("projectType") ?? "").toString().trim();
  const luasTanahParsed = parseLuas(formData.get("luasTanah"));
  const luasBangunanParsed = parseLuas(formData.get("luasBangunan"));
  const tahunRaw = (formData.get("tahun") ?? "").toString().trim();
  const tahunNum = tahunRaw ? Number(tahunRaw) : NaN;
  const startedAtParsed = parseDateOrNull(formData.get("startedAt"));
  const ppnPercent = parsePercent(formData.get("ppnPercent"), "11.00");
  const overheadPercent = parsePercent(
    formData.get("overheadPercent"),
    "10.00",
  );
  const dibulatkanKe = parseInt0OrPositive(formData.get("dibulatkanKe"), 1000);
  const smkkPercent = parsePercent(formData.get("smkkPercent"), "1.50");
  const progressPeriod = parseProgressPeriod(formData.get("progressPeriod"));

  const fieldErrors: Partial<Record<UpdateField, string>> = {};
  if (!name) fieldErrors.name = "Nama project wajib diisi.";
  else if (name.length > 200)
    fieldErrors.name = "Nama project maksimal 200 karakter.";

  if (!regionId)
    fieldErrors.regionId =
      "Lokasi wajib dipilih — IKK provinsi mempengaruhi harga material.";

  if (!projectType) fieldErrors.projectType = "Jenis project wajib dipilih.";

  if (!opd) fieldErrors.opd = "Klien / pemilik proyek wajib diisi.";
  else if (opd.length > 200)
    fieldErrors.opd = "Klien maksimal 200 karakter.";

  if (!ownerName) fieldErrors.ownerName = "Penanggung jawab wajib diisi.";
  else if (ownerName.length > 200)
    fieldErrors.ownerName = "Penanggung jawab maksimal 200 karakter.";

  if (!tahunRaw) fieldErrors.tahun = "Tahun proyek wajib diisi.";
  else if (
    !Number.isInteger(tahunNum) ||
    tahunNum < 1990 ||
    tahunNum > 2100
  )
    fieldErrors.tahun = "Tahun harus angka antara 1990 - 2100.";

  if (!alamat) fieldErrors.alamat = "Alamat lengkap wajib diisi.";
  else if (alamat.length > 300)
    fieldErrors.alamat = "Alamat maksimal 300 karakter.";

  if (luasTanahParsed.invalid)
    fieldErrors.luasTanah = "Luas tanah tidak valid (angka 0 - 10.000.000 m²).";
  if (luasBangunanParsed.invalid)
    fieldErrors.luasBangunan =
      "Luas bangunan tidak valid (angka 0 - 10.000.000 m²).";

  if (startedAtParsed.invalid)
    fieldErrors.startedAt = "Format tanggal tidak valid (gunakan YYYY-MM-DD).";

  if (!isProjectStatus(status)) fieldErrors.status = "Status tidak valid.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }
  const tahun = tahunNum;
  // After validation pass, status is guaranteed valid
  const validatedStatus = status as ProjectStatus;

  const user = await requireUser();

  // RAB terkunci → tolak perubahan config (ppn/overhead/smkk/dibulatkanKe
  // mempengaruhi total kontrak yang sudah di-snapshot). Buka kunci dulu.
  try {
    await assertNotLocked(id);
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "RAB terkunci — buka kunci dulu untuk mengubah.",
    };
  }

  try {
    await db
      .update(schema.projects)
      .set({
        name,
        opd,
        ownerName,
        notes,
        status: validatedStatus,
        regionId,
        alamat,
        lat,
        lng,
        projectType,
        luasTanah: luasTanahParsed.value,
        luasBangunan: luasBangunanParsed.value,
        tahun,
        startedAt: startedAtParsed.value,
        ppnPercent,
        overheadPercent,
        smkkPercent,
        dibulatkanKe,
        progressPeriod,
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

  await logAudit({
    projectId: id,
    userId: user.id,
    action: "update",
    summary: `Data project diperbarui`,
    details: { fields: ["name", "status", "regionId", "alamat", "tahun"] },
  });

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
      lat: source.lat,
      lng: source.lng,
      projectType: source.projectType,
      luasTanah: source.luasTanah,
      luasBangunan: source.luasBangunan,
      ppnPercent: source.ppnPercent,
      overheadPercent: source.overheadPercent,
      smkkPercent: source.smkkPercent,
      dibulatkanKe: source.dibulatkanKe,
      progressPeriod: source.progressPeriod,
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

  // Clone items (preserve snapshot, gak recalc — copy as-is, SEMUA kolom).
  // Dulu cuma 8 kolom → jejak rumus volume (📐), catatan, jadwal Gantt
  // (startWeek/durationWeeks), region override SEMUA hilang di duplikat tanpa
  // peringatan. Sekalian batch insert (dulu N+1 await per item).
  const items = await db
    .select()
    .from(schema.projectItems)
    .where(eq(schema.projectItems.projectId, source.id));
  if (items.length > 0) {
    await db.insert(schema.projectItems).values(
      items.map((it) => ({
        projectId: newProj.id,
        wbsItemId: it.wbsItemId ? wbsIdMap.get(it.wbsItemId) ?? null : null,
        ahspItemId: it.ahspItemId,
        customName: it.customName,
        customUnit: it.customUnit,
        customUnitPrice: it.customUnitPrice,
        volume: it.volume,
        calculatorType: it.calculatorType,
        calculatorInputs: it.calculatorInputs,
        volumeFormula: it.volumeFormula,
        notes: it.notes,
        startWeek: it.startWeek,
        durationWeeks: it.durationWeeks,
        regionOverrideId: it.regionOverrideId,
        sortOrder: it.sortOrder,
      })),
    );
  }

  await logAudit({
    projectId: newProj.id,
    userId: user.id,
    action: "duplicate",
    summary: `Diduplikasi dari "${source.name}"`,
    details: { sourceId: source.id, sourceName: source.name },
  });

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

  await logAudit({
    projectId: id,
    userId: user.id,
    action: archive ? "archive" : "unarchive",
    summary: archive ? "Project diarsipkan" : "Project diaktifkan kembali",
  });

  revalidatePath("/projects");
  if (archive) redirect("/projects");
  redirect(`/projects/${id}`);
}

async function computeLockSnapshot(projectId: string, userId: string) {
  const [proj] = await db
    .select({
      ppnPercent: schema.projects.ppnPercent,
      overheadPercent: schema.projects.overheadPercent,
      smkkPercent: schema.projects.smkkPercent,
      dibulatkanKe: schema.projects.dibulatkanKe,
    })
    .from(schema.projects)
    .where(
      and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)),
    )
    .limit(1);
  if (!proj) return undefined;
  const items = await db
    .select({
      volume: schema.projectItems.volume,
      customUnitPrice: schema.projectItems.customUnitPrice,
    })
    .from(schema.projectItems)
    .where(eq(schema.projectItems.projectId, projectId));
  const subtotal = items.reduce((s, i) => {
    const v = Number(i.volume);
    const p = Number(i.customUnitPrice ?? 0);
    return s + (Number.isFinite(v) && Number.isFinite(p) ? v * p : 0);
  }, 0);
  const r = computeRekap(subtotal, proj);
  return {
    subtotal: r.subtotal,
    overhead: r.overhead,
    smkk: r.smkk,
    ppn: r.ppn,
    total: r.total,
    dibulatkan: r.dibulatkan,
    itemCount: items.length,
  };
}

/**
 * Lock/unlock RAB — freeze nilai kontrak. Saat lock, snapshot total disimpan
 * ke audit log; semua server action mutasi item nolak via assertNotLocked.
 */
export async function toggleLockProject(formData: FormData) {
  const id = (formData.get("id") ?? "").toString();
  const lock = (formData.get("lock") ?? "true").toString() === "true";
  if (!id) throw new Error("Project ID hilang.");
  const user = await requireUser();

  const snapshot = lock ? await computeLockSnapshot(id, user.id) : undefined;

  await db
    .update(schema.projects)
    .set({ lockedAt: lock ? new Date() : null, updatedAt: new Date() })
    .where(
      and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)),
    );

  await logAudit({
    projectId: id,
    userId: user.id,
    action: lock ? "lock" : "unlock",
    summary: lock
      ? `RAB dikunci — total Rp ${(snapshot?.dibulatkan ?? 0).toLocaleString("id-ID")} (freeze kontrak)`
      : "RAB dibuka kembali",
    details: snapshot,
  });

  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

export async function deleteProject(formData: FormData) {
  const id = (formData.get("id") ?? "").toString();
  if (!id) {
    throw new Error("Project ID hilang.");
  }
  const user = await requireUser();
  // Freeze kontrak: RAB terkunci gak bisa dihapus — buka kunci dulu.
  await assertNotLocked(id);
  await db
    .delete(schema.projects)
    .where(
      and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)),
    );
  revalidatePath("/projects");
  redirect("/projects");
}
