import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser, verifyProjectOwnership } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  extractRabFromPdf,
  matchAhspCandidates,
  type AIExtractedRab,
  type AhspMatchCandidate,
} from "@/lib/ai-extract";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 menit — Claude vision PDF bisa lambat

// Ekstraksi AI = 1 panggilan Claude vision per request (mahal). Batasi per-user
// per-jam biar satu akun gak bisa nguras credit API (cost abuse). Counter pakai
// project_audit_log action 'ai_extract' (gak butuh tabel baru).
const AI_EXTRACT_LIMIT_PER_HOUR = 20;

type EnrichedItem = {
  name: string;
  unit: string;
  estimatedVolume: number;
  confidence: "high" | "medium" | "low";
  notes?: string;
  ahspMatches: AhspMatchCandidate[];
};

type EnrichedWbs = {
  code: string;
  name: string;
  items: EnrichedItem[];
};

export type ExtractResponse = {
  projectSummary: string;
  estimatedFloorAreaM2?: number;
  totalHeightM?: number;
  wbs: EnrichedWbs[];
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Login dulu." }, { status: 401 });
  }

  try {
    await verifyProjectOwnership(id, user.id);
  } catch {
    return Response.json(
      { error: "Project gak ketemu atau bukan milikmu." },
      { status: 404 },
    );
  }

  // Rate-limit per-user (cost abuse Claude API): tolak kalau sudah ≥ N ekstraksi
  // dalam 1 jam terakhir. Hitung dari audit log, lalu catat panggilan ini.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  try {
    const [usage] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.projectAuditLog)
      .where(
        and(
          eq(schema.projectAuditLog.userId, user.id),
          eq(schema.projectAuditLog.action, "ai_extract"),
          gte(schema.projectAuditLog.createdAt, oneHourAgo),
        ),
      );
    if ((usage?.n ?? 0) >= AI_EXTRACT_LIMIT_PER_HOUR) {
      return Response.json(
        {
          error: `Batas ${AI_EXTRACT_LIMIT_PER_HOUR} ekstraksi AI per jam tercapai. Coba lagi nanti.`,
        },
        { status: 429 },
      );
    }
  } catch (e) {
    // Counter gagal → fail-open (jangan blokir user gara-gara error counter).
    console.error("[ai-extract] rate-limit check gagal:", e);
  }
  // Catat panggilan ini (jadi counter + provenance "AI baca dokumen").
  await logAudit({
    projectId: id,
    userId: user.id,
    action: "ai_extract",
    summary: "Ekstraksi AI dari dokumen PDF",
  });

  // Parse multipart upload
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "File PDF wajib di-upload (field 'file')." },
      { status: 400 },
    );
  }
  if (file.type !== "application/pdf") {
    return Response.json(
      { error: "File harus PDF (Content-Type: application/pdf)." },
      { status: 400 },
    );
  }
  if (file.size > 30 * 1024 * 1024) {
    return Response.json(
      { error: "PDF maksimal 30 MB. Compress dulu kalau lebih besar." },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let extracted: AIExtractedRab;
  try {
    extracted = await extractRabFromPdf(buffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[ai-extract] Claude API error:", msg);
    return Response.json(
      {
        error:
          "Gagal proses dengan AI: " +
          msg.slice(0, 200) +
          ". Coba lagi atau upload PDF yang lebih jelas.",
      },
      { status: 500 },
    );
  }

  // Load AHSP catalog untuk matching
  const catalog = await db
    .select({
      id: schema.ahspItems.id,
      code: schema.ahspItems.code,
      name: schema.ahspItems.name,
      unit: schema.ahspItems.unit,
    })
    .from(schema.ahspItems);

  // Enrich tiap item dengan AHSP match candidates
  const enriched: EnrichedWbs[] = extracted.wbs_items.map((w) => ({
    code: w.code,
    name: w.name,
    items: w.items.map((it) => ({
      name: it.name,
      unit: it.unit,
      estimatedVolume: it.estimated_volume,
      confidence: it.confidence,
      notes: it.notes,
      ahspMatches: matchAhspCandidates(it.name, it.unit, catalog, 3),
    })),
  }));

  const result: ExtractResponse = {
    projectSummary: extracted.project_summary,
    estimatedFloorAreaM2: extracted.estimated_floor_area_m2,
    totalHeightM: extracted.total_height_m,
    wbs: enriched,
  };

  return Response.json(result);
}
