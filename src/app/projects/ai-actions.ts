"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  requireUser,
  verifyProjectOwnership,
  assertNotLocked,
} from "@/lib/auth";
import { computeAhspPrices } from "@/lib/pricing";
import { normalizeUnit } from "@/lib/units";
import { logAudit } from "@/lib/audit";

// Validasi volume server-side (payload AI bisa di-POST mentah, bypass UI).
// numeric(18,4) → cap < 1e12 biar gak overflow Postgres / inflate total.
const MAX_VOL = 1_000_000_000_000;
function validVol(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= MAX_VOL ? n : null;
}

/**
 * Apply approved AI-extracted items ke project.
 * Batched approach untuk avoid N+1 queries:
 *  1. Fetch all needed AHSP master + components + material prices upfront
 *  2. Compute all prices in JS
 *  3. Insert WBS items in single batch (parent-first sorted)
 *  4. Insert project_items in single batch
 */

type ApplyItem = {
  name: string;
  unit: string;
  volume: number;
  ahspId?: string;
};

type ApplyWbs = {
  code: string;
  name: string;
  items: ApplyItem[];
};

type ApplyPayload = {
  wbs: ApplyWbs[];
};

function parseWbsCode(code: string) {
  const parts = code.split(".");
  return {
    level: parts.length - 1,
    parentCode: parts.length > 1 ? parts.slice(0, -1).join(".") : null,
  };
}

function sortByCode(a: string, b: string): number {
  const ap = a.split(".").map(Number);
  const bp = b.split(".").map(Number);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export async function applyAiExtraction(formData: FormData) {
  const projectId = (formData.get("projectId") ?? "").toString();
  const payloadStr = (formData.get("payload") ?? "").toString();
  if (!projectId || !payloadStr) throw new Error("projectId atau payload hilang.");

  const user = await requireUser();
  await verifyProjectOwnership(projectId, user.id);
  await assertNotLocked(projectId);

  const [projRow] = await db
    .select({ regionId: schema.projects.regionId })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);
  const projectRegionId = projRow?.regionId ?? null;

  let payload: ApplyPayload;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    throw new Error("Payload JSON gak valid.");
  }
  if (!Array.isArray(payload.wbs) || payload.wbs.length === 0) {
    throw new Error("Tidak ada item yang ke-approve.");
  }

  // ─── Step 1: Bulk fetch existing WBS + count existing items ────────────
  // MERGE behavior: existing WBS dengan code sama di-reuse, existing items
  // gak dihapus, AI items di-append dengan sortOrder lanjutan.
  const existingWbs = await db
    .select({ id: schema.wbsItems.id, code: schema.wbsItems.code })
    .from(schema.wbsItems)
    .where(eq(schema.wbsItems.projectId, projectId));
  const wbsByCode = new Map<string, string>();
  for (const w of existingWbs) wbsByCode.set(w.code, w.id);

  // Get max sortOrder existing items biar AI items append di belakang
  const existingItems = await db
    .select({ sortOrder: schema.projectItems.sortOrder })
    .from(schema.projectItems)
    .where(eq(schema.projectItems.projectId, projectId));
  const maxItemSortOrder = existingItems.reduce(
    (max, it) => Math.max(max, it.sortOrder),
    -1,
  );

  // ─── Step 2: Insert new WBS hierarchical (parent-first) ─────────────────
  const sortedWbs = [...payload.wbs].sort((a, b) => sortByCode(a.code, b.code));
  let wbsSortOrder = existingWbs.length;
  for (const w of sortedWbs) {
    if (wbsByCode.has(w.code)) continue;
    const { level, parentCode } = parseWbsCode(w.code);
    const parentId = parentCode ? wbsByCode.get(parentCode) ?? null : null;
    const [inserted] = await db
      .insert(schema.wbsItems)
      .values({
        projectId,
        parentId,
        code: w.code,
        name: w.name,
        level,
        sortOrder: wbsSortOrder++,
      })
      .returning({ id: schema.wbsItems.id });
    wbsByCode.set(w.code, inserted.id);
  }

  // ─── Step 3: Collect all unique AHSP IDs needed ─────────────────────────
  const ahspIds = new Set<string>();
  for (const w of payload.wbs) {
    for (const it of w.items) {
      if (it.ahspId && it.name && validVol(it.volume) != null)
        ahspIds.add(it.ahspId);
    }
  }

  // ─── Step 4: Bulk fetch AHSP master + components + material prices ──────
  const ahspMasterMap = new Map<
    string,
    { name: string; unit: string; basePrice: number }
  >();

  if (ahspIds.size > 0) {
    const ahspIdList = Array.from(ahspIds);

    // Bulk fetch AHSP master info
    const ahspMasters = await db
      .select({
        id: schema.ahspItems.id,
        name: schema.ahspItems.name,
        unit: schema.ahspItems.unit,
      })
      .from(schema.ahspItems)
      .where(inArray(schema.ahspItems.id, ahspIdList));

    // Harga via lib/pricing (region-aware + IKK, satu sumber kebenaran) —
    // fix bug lama: ASC + tanpa filter tanggal/region + tanpa IKK.
    const ahspPrices = await computeAhspPrices(ahspIdList, projectRegionId);
    for (const m of ahspMasters) {
      ahspMasterMap.set(m.id, {
        name: m.name,
        unit: m.unit,
        basePrice: Number(ahspPrices.get(m.id)?.price ?? 0),
      });
    }
  }

  // ─── Step 5: Build all project_items rows ───────────────────────────────
  type ItemRow = typeof schema.projectItems.$inferInsert;
  const itemRows: ItemRow[] = [];
  let itemSortOrder = maxItemSortOrder + 1; // append, gak overwrite

  for (const w of sortedWbs) {
    const wbsId = wbsByCode.get(w.code);
    if (!wbsId) continue;

    for (const it of w.items) {
      // Validasi server-side (parity dgn import-actions): volume finite & >0 &
      // <cap, nama di-cap 200, satuan dinormalisasi & di-cap 30. Payload AI bisa
      // di-POST mentah (server action publik) → jangan percaya client.
      const vol = validVol(it.volume);
      const name = String(it.name ?? "")
        .trim()
        .slice(0, 200);
      if (!name || vol == null) continue;

      if (it.ahspId) {
        const master = ahspMasterMap.get(it.ahspId);
        if (!master) continue; // AHSP gak ditemukan, skip
        itemRows.push({
          projectId,
          wbsItemId: wbsId,
          ahspItemId: it.ahspId,
          customName: master.name,
          customUnit: master.unit,
          customUnitPrice: master.basePrice.toFixed(2),
          volume: vol.toString(),
          sortOrder: itemSortOrder++,
        });
      } else {
        itemRows.push({
          projectId,
          wbsItemId: wbsId,
          ahspItemId: null,
          customName: name,
          customUnit: (normalizeUnit(String(it.unit ?? "")) || "ls").slice(
            0,
            30,
          ),
          customUnitPrice: "0",
          volume: vol.toString(),
          sortOrder: itemSortOrder++,
        });
      }
    }
  }

  // ─── Step 6: Bulk insert items in chunks ────────────────────────────────
  if (itemRows.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < itemRows.length; i += CHUNK) {
      const chunk = itemRows.slice(i, i + CHUNK);
      await db.insert(schema.projectItems).values(chunk);
    }
  }

  // Jejak audit (parity dgn import_excel) — newWbs = WBS yang BARU dibuat
  // (existing code di-reuse, jadi bukan payload.wbs.length).
  await logAudit({
    projectId,
    userId: user.id,
    action: "ai_import",
    summary: `AI extract: +${itemRows.length} item, +${wbsSortOrder - existingWbs.length} WBS`,
    details: {
      itemCount: itemRows.length,
      withAhsp: itemRows.filter((r) => r.ahspItemId != null).length,
      newWbs: wbsSortOrder - existingWbs.length,
    },
  });
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
