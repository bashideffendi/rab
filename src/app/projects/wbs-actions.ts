"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, verifyProjectOwnership } from "@/lib/auth";

const CODE_RE = /^\d+(\.\d+)*$/;

function parseWbsCode(code: string) {
  const parts = code.split(".");
  return {
    level: parts.length - 1,
    parentCode: parts.length > 1 ? parts.slice(0, -1).join(".") : null,
  };
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export type CreateWbsFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"code" | "name", string>>;
};

export async function createWbsItem(
  projectId: string,
  _prev: CreateWbsFormState,
  formData: FormData,
): Promise<CreateWbsFormState> {
  const code = (formData.get("code") ?? "").toString().trim();
  const name = (formData.get("name") ?? "").toString().trim();

  if (!code) {
    return { fieldErrors: { code: "Code WBS wajib diisi (mis. 1.2.1)." } };
  }
  if (!CODE_RE.test(code)) {
    return {
      fieldErrors: {
        code: "Format code: angka dipisah titik. Contoh: 1, 1.1, 1.2.3.",
      },
    };
  }
  if (!name) {
    return { fieldErrors: { name: "Nama pekerjaan wajib diisi." } };
  }
  if (name.length > 200) {
    return { fieldErrors: { name: "Nama maksimal 200 karakter." } };
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

  const { level, parentCode } = parseWbsCode(code);

  let parentId: string | null = null;
  try {
    if (parentCode) {
      const parentRows = await db
        .select({ id: schema.wbsItems.id })
        .from(schema.wbsItems)
        .where(
          and(
            eq(schema.wbsItems.projectId, projectId),
            eq(schema.wbsItems.code, parentCode),
          ),
        )
        .limit(1);
      if (!parentRows[0]) {
        return {
          fieldErrors: {
            code: `Parent code "${parentCode}" belum ada. Bikin dulu sebelum lanjut.`,
          },
        };
      }
      parentId = parentRows[0].id;
    }

    await db.insert(schema.wbsItems).values({
      projectId,
      parentId,
      code,
      name,
      level,
      sortOrder: 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal simpan WBS.";
    if (/duplicate|unique/i.test(msg)) {
      return {
        fieldErrors: {
          code: `Code "${code}" udah ada di project ini.`,
        },
      };
    }
    return { error: `Gagal simpan: ${msg}` };
  }

  revalidatePath(`/projects/${projectId}`);
  return {};
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export type UpdateWbsFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"code" | "name", string>>;
  success?: boolean;
};

export async function updateWbsItem(
  id: string,
  projectId: string,
  _prev: UpdateWbsFormState,
  formData: FormData,
): Promise<UpdateWbsFormState> {
  const code = (formData.get("code") ?? "").toString().trim();
  const name = (formData.get("name") ?? "").toString().trim();

  if (!code) {
    return { fieldErrors: { code: "Code wajib." } };
  }
  if (!CODE_RE.test(code)) {
    return {
      fieldErrors: {
        code: "Format: angka dipisah titik. Contoh: 1, 1.1, 1.2.3.",
      },
    };
  }
  if (!name) {
    return { fieldErrors: { name: "Nama wajib." } };
  }
  if (name.length > 200) {
    return { fieldErrors: { name: "Maks 200 karakter." } };
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

  const { level, parentCode } = parseWbsCode(code);

  let parentId: string | null = null;
  try {
    if (parentCode) {
      const parentRows = await db
        .select({ id: schema.wbsItems.id })
        .from(schema.wbsItems)
        .where(
          and(
            eq(schema.wbsItems.projectId, projectId),
            eq(schema.wbsItems.code, parentCode),
          ),
        )
        .limit(1);
      if (!parentRows[0]) {
        return {
          fieldErrors: {
            code: `Parent code "${parentCode}" belum ada.`,
          },
        };
      }
      parentId = parentRows[0].id;
    }

    await db
      .update(schema.wbsItems)
      .set({ code, name, level, parentId })
      .where(
        and(
          eq(schema.wbsItems.id, id),
          eq(schema.wbsItems.projectId, projectId),
        ),
      );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal update WBS.";
    if (/duplicate|unique/i.test(msg)) {
      return {
        fieldErrors: {
          code: `Code "${code}" udah dipakai item lain di project ini.`,
        },
      };
    }
    return { error: `Gagal: ${msg}` };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deleteWbsItem(formData: FormData) {
  const id = (formData.get("id") ?? "").toString();
  const projectId = (formData.get("projectId") ?? "").toString();
  if (!id || !projectId) {
    throw new Error("WBS ID atau project ID hilang.");
  }
  const user = await requireUser();
  await verifyProjectOwnership(projectId, user.id);
  await db
    .delete(schema.wbsItems)
    .where(
      and(
        eq(schema.wbsItems.id, id),
        eq(schema.wbsItems.projectId, projectId),
      ),
    );
  revalidatePath(`/projects/${projectId}`);
}
