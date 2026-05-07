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
      .values({ userId: user.id, name, opd, ownerName, notes, regionId })
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
