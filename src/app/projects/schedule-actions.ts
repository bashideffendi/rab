"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, verifyProjectOwnership } from "@/lib/auth";

/**
 * Bulk update schedule (start_week + duration_weeks) untuk multiple items
 * dalam 1 project. Payload: array of { itemId, startWeek, durationWeeks }.
 */
export async function updateItemsSchedule(formData: FormData) {
  const projectId = (formData.get("projectId") ?? "").toString();
  const payloadStr = (formData.get("payload") ?? "").toString();
  if (!projectId || !payloadStr) {
    throw new Error("projectId atau payload hilang.");
  }

  const user = await requireUser();
  await verifyProjectOwnership(projectId, user.id);

  let payload: Array<{
    itemId: string;
    startWeek: number | null;
    durationWeeks: number | null;
  }>;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    throw new Error("Payload JSON gak valid.");
  }
  if (!Array.isArray(payload)) {
    throw new Error("Payload harus array.");
  }

  // Update per item (sequentially — gak terlalu banyak biasanya)
  for (const p of payload) {
    if (!p.itemId) continue;
    await db
      .update(schema.projectItems)
      .set({
        startWeek: p.startWeek,
        durationWeeks: p.durationWeeks,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.projectItems.id, p.itemId),
          eq(schema.projectItems.projectId, projectId),
        ),
      );
  }

  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}`);
}
