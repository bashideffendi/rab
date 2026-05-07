import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BUCKET = "project-covers";

/**
 * POST /api/projects/[id]/cover
 * Upload foto sampul (multipart form-data, field 'file').
 * - Validate ownership, mime type, size.
 * - Upload ke Supabase Storage bucket 'project-covers' as `<projectId>/<uuid>.<ext>`.
 * - Update projects.cover_image_url ke public URL.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id: projectId } = await params;

  // Verify project ownership
  const [proj] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, user.id),
      ),
    )
    .limit(1);
  if (!proj) {
    return Response.json(
      { error: "Project tidak ditemukan." },
      { status: 404 },
    );
  }

  // Parse multipart
  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) {
      return Response.json(
        { error: "File tidak ditemukan di form-data." },
        { status: 400 },
      );
    }
    file = f;
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error ? e.message : "Gagal parsing form-data.",
      },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIMES.has(file.type)) {
    return Response.json(
      { error: "Format harus JPG, PNG, atau WEBP." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "Ukuran file maksimal 5 MB." },
      { status: 400 },
    );
  }

  // Upload via Supabase client (auth user context)
  const supabase = await createClient();
  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const fileName = `${projectId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    return Response.json(
      { error: `Gagal upload: ${uploadErr.message}` },
      { status: 500 },
    );
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  const publicUrl = pub.publicUrl;

  // Save URL to project
  await db
    .update(schema.projects)
    .set({ coverImageUrl: publicUrl, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId));

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");

  return Response.json({ url: publicUrl });
}

/**
 * DELETE /api/projects/[id]/cover — clear cover_image_url.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id: projectId } = await params;

  const [proj] = await db
    .select({
      id: schema.projects.id,
      coverImageUrl: schema.projects.coverImageUrl,
    })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, user.id),
      ),
    )
    .limit(1);
  if (!proj) {
    return Response.json(
      { error: "Project tidak ditemukan." },
      { status: 404 },
    );
  }

  // Optional: delete file from storage (best effort)
  if (proj.coverImageUrl) {
    const supabase = await createClient();
    const match = proj.coverImageUrl.match(/\/project-covers\/(.+)$/);
    if (match?.[1]) {
      await supabase.storage.from(BUCKET).remove([match[1]]);
    }
  }

  await db
    .update(schema.projects)
    .set({ coverImageUrl: null, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId));

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return Response.json({ ok: true });
}
