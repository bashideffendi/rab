"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";

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
