import Anthropic from "@anthropic-ai/sdk";

/**
 * AI extraction layer — call Claude API dengan PDF gambar kerja,
 * dapet draft RAB structured.
 *
 * Model dibaca dari ANTHROPIC_MODEL env var; fallback ke DEFAULT_MODEL.
 * Set ANTHROPIC_MODEL (e.g. claude-haiku-4-5 buat hemat) tanpa ubah kode.
 *
 * Output: WBS hierarchical + items dengan estimasi volume + confidence.
 * Server-side matching ke AHSP catalog dilakukan terpisah (lib/ahsp-match).
 */

export type AIExtractedItem = {
  name: string;
  unit: string;
  estimated_volume: number;
  confidence: "high" | "medium" | "low";
  notes?: string;
};

export type AIExtractedWbs = {
  code: string;
  name: string;
  items: AIExtractedItem[];
};

export type AIExtractedRab = {
  project_summary: string;
  estimated_floor_area_m2?: number;
  total_height_m?: number;
  wbs_items: AIExtractedWbs[];
};

const DEFAULT_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Kamu adalah engineer sipil senior estimator yang ahli ngebaca gambar kerja konstruksi Indonesia. Tugasmu: analisa gambar kerja PDF yang di-upload, extract draft Rencana Anggaran Biaya (RAB) yang lengkap dan terstruktur.

WAJIB: Output via tool call submit_rab_suggestions HARUS include field "wbs_items" dengan minimal 8-10 WBS entries dan items di dalamnya. Tanpa wbs_items, output dianggap gagal dan akan ditolak.

Aturan penting:
1. WBS hierarchical pakai code numerik dengan dot ("1", "1.1", "1.2.3"). Untuk rumah/gedung, tipikal struktur:
   - 1. Pekerjaan Persiapan
   - 2. Pekerjaan Tanah (galian, urugan)
   - 3. Pekerjaan Pondasi
   - 4. Pekerjaan Sloof
   - 5. Pekerjaan Kolom
   - 6. Pekerjaan Balok (sloof, ring, latei)
   - 7. Pekerjaan Plat / Lantai Beton
   - 8. Pekerjaan Atap
   - 9. Pekerjaan Dinding (pasangan bata)
   - 10. Pekerjaan Plester & Acian
   - 11. Pekerjaan Lantai (keramik, granit)
   - 12. Pekerjaan Plafon
   - 13. Pekerjaan Pintu & Jendela (kusen, daun, kaca)
   - 14. Pekerjaan Sanitasi
   - 15. Pekerjaan Listrik
   - 16. Pekerjaan Finishing (cat)

2. Item naming: kalimat deskriptif singkat, gak terlalu panjang. Contoh:
   - "Galian tanah pondasi"
   - "Beton K-225 sloof"
   - "Pasangan bata merah 1:4"
   - "Plesteran 1:4 tebal 15 mm"
   - "Lantai keramik 40x40"
   - "Cat tembok eksterior"
   - "Pintu kayu daun + kusen"

3. Satuan standar konstruksi:
   - m3 untuk volume (galian, urugan, beton, pasangan batu)
   - m2 untuk luas (lantai, dinding, plester, atap, plafon, cat)
   - kg untuk besi tulangan
   - buah / unit untuk pintu, jendela, kloset, lampu
   - titik untuk instalasi listrik (lampu, stop kontak, saklar)
   - m1 atau m untuk linear (kabel, pipa)

4. ESTIMASI VOLUME:
   - Hitung dari dimensi yang JELAS terbaca di drawing.
   - Untuk volume struktur, gunakan elevations + dimensi denah.
     Contoh: kolom 4×kolom × 0.15m × 0.15m × 3.5m tinggi = 0.315 m³ × 4 = 1.26 m³
   - Untuk dinding, hitung keliling × tinggi - bukaan (pintu/jendela).
   - Confidence:
     * "high" — dimensi terbaca langsung dari label/dimensi line
     * "medium" — interpolasi atau perkiraan dari skala
     * "low" — gak yakin, user wajib verifikasi
   - JANGAN ngarang dimensi. Lebih baik confidence "low" daripada angka palsu.

5. Catatan: kalau ada item yang gak bisa diestimasi (info kurang), tetap masukkan dengan estimated_volume = 0 dan confidence "low" + notes ngejelasin yang missing. Jangan skip — biar user tau ada item yang harus diisi manual.

6. Output via tool call submit_rab_suggestions. Wajib pake tool, jangan free text.`;

export async function extractRabFromPdf(
  pdfBuffer: Buffer | Uint8Array,
): Promise<AIExtractedRab> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set di env");
  }

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  const base64Pdf = Buffer.from(pdfBuffer).toString("base64");

  const response = await client.messages.create({
    model,
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "submit_rab_suggestions",
        description:
          "Submit struktur RAB hasil ekstraksi dari gambar kerja. Output harus comprehensive — semua WBS standar konstruksi dengan items + estimasi volume per item.",
        input_schema: {
          type: "object" as const,
          properties: {
            project_summary: {
              type: "string",
              description:
                "Ringkasan singkat project (1-3 kalimat): tipe bangunan, jumlah lantai, luas estimasi, fitur utama.",
            },
            estimated_floor_area_m2: {
              type: "number",
              description: "Total luas lantai bangunan dalam m2 (kalau bisa diestimasi).",
            },
            total_height_m: {
              type: "number",
              description: "Tinggi total bangunan dalam meter (dari sloof ke puncak atap).",
            },
            wbs_items: {
              type: "array",
              description: "List WBS hierarchical, sorted by code.",
              items: {
                type: "object",
                properties: {
                  code: {
                    type: "string",
                    description: 'Kode WBS hierarchical: "1", "1.1", "1.2.3", dll',
                  },
                  name: {
                    type: "string",
                    description: 'Nama WBS, e.g., "Pekerjaan Pondasi"',
                  },
                  items: {
                    type: "array",
                    description:
                      "Items pekerjaan di bawah WBS ini. Bisa kosong kalau WBS-nya cuma kategori header (sub-WBS akan punya itemsnya).",
                    items: {
                      type: "object",
                      properties: {
                        name: {
                          type: "string",
                          description: "Deskripsi pekerjaan",
                        },
                        unit: {
                          type: "string",
                          description:
                            "Satuan: m3, m2, kg, buah, unit, titik, m1",
                        },
                        estimated_volume: {
                          type: "number",
                          description:
                            "Estimasi volume kuantitatif. 0 kalau gak bisa diestimasi.",
                        },
                        confidence: {
                          type: "string",
                          enum: ["high", "medium", "low"],
                          description:
                            "high=dimensi langsung terbaca, medium=interpolasi, low=tidak yakin/manual",
                        },
                        notes: {
                          type: "string",
                          description:
                            "Catatan opsional: dasar estimasi, asumsi, atau warning kalau confidence low.",
                        },
                      },
                      required: [
                        "name",
                        "unit",
                        "estimated_volume",
                        "confidence",
                      ],
                    },
                  },
                },
                required: ["code", "name", "items"],
              },
            },
          },
          required: ["project_summary", "wbs_items"],
        },
      },
    ],
    tool_choice: { type: "tool" as const, name: "submit_rab_suggestions" },
    messages: [
      {
        role: "user" as const,
        content: [
          {
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: base64Pdf,
            },
          },
          {
            type: "text" as const,
            text: `Tolong analisa gambar kerja ini dan output draft RAB lengkap via tool submit_rab_suggestions.

WAJIB include "wbs_items" dengan minimal 10 WBS entries (Persiapan, Tanah, Pondasi, Sloof, Kolom, Balok, Plat, Atap, Dinding, Plester/Acian, Lantai, Plafon, Pintu/Jendela, Listrik, Sanitasi, Finishing). Tiap WBS punya items dengan estimated_volume + confidence. Kalau gak yakin volume-nya, tetap masukkan dengan estimated_volume=0 dan confidence="low" + notes — JANGAN skip item.

Field "wbs_items" tidak boleh empty. Kalau benar-benar gak bisa baca drawing, tetap output WBS dengan items confidence="low" estimated_volume=0 — biar user tau ada yang harus diisi manual.`,
          },
        ],
      },
    ],
  });

  // Extract tool use block
  const toolUseBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    console.error(
      "[ai-extract] No tool_use block. Full response:",
      JSON.stringify(response.content).slice(0, 1500),
    );
    throw new Error(
      "Claude API gak return tool_use block. Stop_reason: " +
        response.stop_reason,
    );
  }

  const raw = toolUseBlock.input as Record<string, unknown>;

  // Debug log shape (info, not error)
  console.log(
    "[ai-extract] Tool input keys:",
    Object.keys(raw).join(", "),
    "| wbs count:",
    Array.isArray(raw.wbs_items) ? (raw.wbs_items as unknown[]).length : "N/A",
  );

  // Defensive: kadang Claude pake camelCase walaupun schema snake_case
  const wbsItems =
    raw.wbs_items ??
    (raw as Record<string, unknown>).wbsItems ??
    (raw as Record<string, unknown>).wbs ??
    [];

  if (!Array.isArray(wbsItems) || wbsItems.length === 0) {
    console.error(
      "[ai-extract] No wbs_items in response. Stop reason:",
      response.stop_reason,
      "| Raw input:",
      JSON.stringify(raw).slice(0, 2000),
    );
    const reason =
      response.stop_reason === "max_tokens"
        ? "Output terlalu panjang (limit max_tokens). Coba PDF yang lebih sedikit halaman, atau split per-section."
        : "Claude gak generate WBS items meski struktur dimensi terbaca. Mungkin format gambar terlalu kompleks atau PDF terlalu besar.";
    throw new Error(reason);
  }

  // Normalize: ensure all WBS entries have items array
  const normalized = (wbsItems as Array<Record<string, unknown>>).map(
    (w) => ({
      code: String(w.code ?? ""),
      name: String(w.name ?? ""),
      items: Array.isArray(w.items)
        ? (w.items as Array<Record<string, unknown>>).map((it) => ({
            name: String(it.name ?? ""),
            unit: String(it.unit ?? ""),
            estimated_volume: Number(
              it.estimated_volume ?? it.estimatedVolume ?? 0,
            ),
            confidence: (it.confidence as "high" | "medium" | "low") ?? "low",
            notes: it.notes ? String(it.notes) : undefined,
          }))
        : [],
    }),
  );

  return {
    project_summary: String(raw.project_summary ?? raw.projectSummary ?? ""),
    estimated_floor_area_m2:
      typeof raw.estimated_floor_area_m2 === "number"
        ? raw.estimated_floor_area_m2
        : typeof raw.estimatedFloorAreaM2 === "number"
          ? raw.estimatedFloorAreaM2
          : undefined,
    total_height_m:
      typeof raw.total_height_m === "number"
        ? raw.total_height_m
        : typeof raw.totalHeightM === "number"
          ? raw.totalHeightM
          : undefined,
    wbs_items: normalized,
  };
}

/**
 * Fuzzy-match suggested item name ke AHSP catalog.
 * Returns top N candidates dengan score, sorted descending.
 */
export type AhspMatchCandidate = {
  ahspId: string;
  ahspCode: string;
  ahspName: string;
  unit: string;
  score: number; // 0-1, higher = better match
};

function tokenize(s: string): string[] {
  const lower = s.toLowerCase();
  // Pertahankan token PEMBEDA (mutu beton K-225/K-300, f'c, rasio campuran 1:4,
  // diameter Ø12) SEBELUM filter panjang ≥3 — kalau gak, "beton K-225" vs
  // "K-300" tokenize identik {beton} → auto-match bisa salah-pick mutu.
  const special: string[] = [];
  for (const m of lower.matchAll(/k[\s-]?(\d{2,3})\b/g)) special.push("k" + m[1]);
  for (const m of lower.matchAll(/f'?c[\s=]*([\d,]+)/g))
    special.push("fc" + m[1].replace(",", ".").replace(/\.$/, ""));
  for (const m of lower.matchAll(/(\d+)\s*:\s*(\d+)/g))
    special.push(m[1] + ":" + m[2]);
  for (const m of lower.matchAll(/[ø⌀d](\d{1,2})\b/g)) special.push("d" + m[1]);
  const base = lower
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return [...base, ...special];
}

/**
 * Jaccard token similarity. Cocok untuk match nama AHSP yang punya
 * banyak kata dengan deskripsi item user. Output 0-1.
 */
export function similarityScore(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersect = 0;
  for (const t of ta) if (tb.has(t)) intersect++;
  const union = new Set([...ta, ...tb]).size;
  return intersect / union;
}

export function matchAhspCandidates(
  itemName: string,
  itemUnit: string,
  catalog: Array<{ id: string; code: string; name: string; unit: string }>,
  topN = 3,
): AhspMatchCandidate[] {
  const candidates = catalog.map((c) => ({
    ahspId: c.id,
    ahspCode: c.code,
    ahspName: c.name,
    unit: c.unit,
    score:
      similarityScore(itemName, c.name) *
      // Boost kalau unit match
      (c.unit.toLowerCase() === itemUnit.toLowerCase() ? 1.3 : 1.0),
  }));
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, topN).filter((c) => c.score > 0.15);
}
