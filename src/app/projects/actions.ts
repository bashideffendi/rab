"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

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

  if (!name) {
    return { fieldErrors: { name: "Nama project wajib diisi." } };
  }
  if (name.length > 200) {
    return { fieldErrors: { name: "Nama project maksimal 200 karakter." } };
  }

  let inserted: { id: string } | undefined;
  try {
    const rows = await db
      .insert(schema.projects)
      .values({ name, opd, ownerName, notes })
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

  if (!name) {
    return { fieldErrors: { name: "Nama project wajib diisi." } };
  }
  if (name.length > 200) {
    return { fieldErrors: { name: "Nama project maksimal 200 karakter." } };
  }
  if (!isProjectStatus(status)) {
    return { fieldErrors: { status: "Status tidak valid." } };
  }

  try {
    await db
      .update(schema.projects)
      .set({ name, opd, ownerName, notes, status, updatedAt: new Date() })
      .where(eq(schema.projects.id, id));
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
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
  revalidatePath("/projects");
  redirect("/projects");
}
