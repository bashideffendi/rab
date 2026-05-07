import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createClient } from "@/lib/supabase/server";

/**
 * Get current authenticated user. Untuk pakai di RSC + Server Action.
 * Return user object dengan id, email, dll.
 *
 * Throw redirect kalau gak login — proxy seharusnya udah handle ini, tapi
 * defense in depth biar gak ada query bocor sebelum auth check.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Verify project belongs to user. Throw kalau gak.
 * Pakai di server actions sebelum mutate apapun yang nyangkut project.
 */
export async function verifyProjectOwnership(
  projectId: string,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, userId),
      ),
    )
    .limit(1);
  if (!rows[0]) {
    throw new Error("Project gak ditemukan atau bukan milikmu.");
  }
}
