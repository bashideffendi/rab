import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  buildProjectWorkbook,
  safeFilename,
  type ExportAhsItem,
  type ExportBreakdownRow,
  type ExportItem,
  type ExportProject,
} from "@/lib/excel-export";
import { getCurrentUser, verifyProjectOwnership } from "@/lib/auth";
import {
  getLatestMaterialPrices,
  getIkkMultiplier,
  isCorruptPrice,
} from "@/lib/pricing";
import { loadBreakdownRows } from "@/lib/breakdown";

export const dynamic = "force-dynamic";

async function loadProject(id: string): Promise<
  | (ExportProject & { regionId: string | null })
  | null
> {
  const rows = await db
    .select({
      name: schema.projects.name,
      opd: schema.projects.opd,
      ownerName: schema.projects.ownerName,
      status: schema.projects.status,
      notes: schema.projects.notes,
      tahun: schema.projects.tahun,
      alamat: schema.projects.alamat,
      ppnPercent: schema.projects.ppnPercent,
      overheadPercent: schema.projects.overheadPercent,
      smkkPercent: schema.projects.smkkPercent,
      dibulatkanKe: schema.projects.dibulatkanKe,
      regionId: schema.projects.regionId,
    })
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function loadBreakdown(
  projectId: string,
  regionId: string | null,
): Promise<ExportBreakdownRow[]> {
  // Delegasi ke helper bersama (region-aware IKK + sanity-gate) — angka sama
  // persis dgn halaman /breakdown & /print + rekonsiliasi ke subtotal RAB.
  const rows = await loadBreakdownRows(projectId, regionId);
  return rows.map(({ materialId: _id, ...rest }) => rest);
}

async function loadItems(projectId: string): Promise<ExportItem[]> {
  const rows = await db
    .select({
      wbsCode: schema.wbsItems.code,
      wbsName: schema.wbsItems.name,
      customName: schema.projectItems.customName,
      customUnit: schema.projectItems.customUnit,
      volume: schema.projectItems.volume,
      customUnitPrice: schema.projectItems.customUnitPrice,
      ahspCode: schema.ahspItems.code,
      ahspName: schema.ahspItems.name,
      ahspUnit: schema.ahspItems.unit,
      ahspSourceDoc: schema.ahspItems.sourceDoc,
      volumeFormula: schema.projectItems.volumeFormula,
    })
    .from(schema.projectItems)
    .leftJoin(
      schema.wbsItems,
      eq(schema.wbsItems.id, schema.projectItems.wbsItemId),
    )
    .leftJoin(
      schema.ahspItems,
      eq(schema.ahspItems.id, schema.projectItems.ahspItemId),
    )
    .where(eq(schema.projectItems.projectId, projectId))
    .orderBy(asc(schema.projectItems.sortOrder));

  return rows.map((r) => ({
    wbsCode: r.wbsCode,
    wbsName: r.wbsName,
    name: r.customName ?? r.ahspName ?? "(item)",
    unit: r.customUnit ?? r.ahspUnit ?? "",
    volume: r.volume,
    unitPrice: r.customUnitPrice ?? "0",
    ahspCode: r.ahspCode,
    ahspSourceDoc: r.ahspSourceDoc,
    volumeFormula: r.volumeFormula,
  }));
}

async function loadAhs(
  projectId: string,
  regionId: string | null,
): Promise<ExportAhsItem[]> {
  const rows = await db
    .select({
      itemId: schema.projectItems.id,
      customName: schema.projectItems.customName,
      customUnit: schema.projectItems.customUnit,
      customUnitPrice: schema.projectItems.customUnitPrice,
      volume: schema.projectItems.volume,
      ahspItemId: schema.projectItems.ahspItemId,
      ahspCode: schema.ahspItems.code,
      ahspName: schema.ahspItems.name,
      ahspUnit: schema.ahspItems.unit,
      materialId: schema.materials.id,
      materialName: schema.materials.name,
      materialType: schema.materials.type,
      materialUnit: schema.materials.unit,
      coefficient: schema.ahspComponents.coefficient,
    })
    .from(schema.projectItems)
    .leftJoin(
      schema.ahspItems,
      eq(schema.ahspItems.id, schema.projectItems.ahspItemId),
    )
    .leftJoin(
      schema.ahspComponents,
      eq(schema.ahspComponents.ahspItemId, schema.projectItems.ahspItemId),
    )
    .leftJoin(
      schema.materials,
      eq(schema.materials.id, schema.ahspComponents.materialId),
    )
    .where(eq(schema.projectItems.projectId, projectId))
    .orderBy(asc(schema.projectItems.sortOrder));

  const matIds = [
    ...new Set(
      rows.map((r) => r.materialId).filter((x): x is string => x !== null),
    ),
  ];
  const priceMap = await getLatestMaterialPrices(matIds, regionId);
  const ikk = await getIkkMultiplier(regionId);

  const TYPE_RANK: Record<string, number> = { tenaga: 0, bahan: 1, alat: 2 };
  const byItem = new Map<string, ExportAhsItem>();
  const order: string[] = [];
  for (const r of rows) {
    let it = byItem.get(r.itemId);
    if (!it) {
      it = {
        itemNo: 0,
        ahspCode: r.ahspCode,
        name: r.customName ?? r.ahspName ?? "(item)",
        unit: r.customUnit ?? r.ahspUnit ?? "",
        volume: Number(r.volume) || 0,
        isCustom: r.ahspItemId === null,
        customUnitPrice: Number(r.customUnitPrice ?? 0),
        components: [],
        hsp: 0,
      };
      byItem.set(r.itemId, it);
      order.push(r.itemId);
    }
    if (r.materialId && r.materialType && r.coefficient != null) {
      const base = priceMap.get(r.materialId)?.price;
      // Gate identik computeAhspPrices: skip komponen tanpa harga / harga
      // janggal → Σ komponen AHS sheet == customUnitPrice di RAB sheet (gak
      // ada lagi 1 file XLSX yang kontradiksi RAB vs AHS).
      if (base == null || isCorruptPrice(r.materialType, r.materialUnit, base)) {
        continue;
      }
      const hargaSatuan = base * ikk;
      const coef = Number(r.coefficient) || 0;
      it.components.push({
        type: r.materialType,
        name: r.materialName ?? "",
        unit: r.materialUnit ?? "",
        coefficient: coef,
        hargaSatuan,
        subtotal: coef * hargaSatuan,
      });
    }
  }

  let no = 1;
  const result: ExportAhsItem[] = [];
  for (const itemId of order) {
    const it = byItem.get(itemId)!;
    it.itemNo = no++;
    it.components.sort((a, b) => TYPE_RANK[a.type] - TYPE_RANK[b.type]);
    it.hsp = it.isCustom
      ? it.customUnitPrice
      : it.components.reduce((s, c) => s + c.subtotal, 0);
    result.push(it);
  }
  return result;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const useRoman =
    new URL(request.url).searchParams.get("format") === "roman";

  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Login dulu." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await verifyProjectOwnership(id, user.id);
  } catch {
    return new Response(
      JSON.stringify({ error: "Project gak ditemukan atau bukan milikmu." }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  let project: Awaited<ReturnType<typeof loadProject>> = null;
  let items: ExportItem[] = [];
  let breakdown: ExportBreakdownRow[] = [];
  let ahs: ExportAhsItem[] = [];
  try {
    project = await loadProject(id);
    items = await loadItems(id);
    if (project) {
      breakdown = await loadBreakdown(id, project.regionId);
      ahs = await loadAhs(id, project.regionId);
    }
  } catch (e) {
    return new Response(
      JSON.stringify({
        error:
          e instanceof Error
            ? `Gagal load data: ${e.message}`
            : "Gagal load data project.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!project) {
    return new Response(JSON.stringify({ error: "Project gak ketemu." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const wb = await buildProjectWorkbook(project, items, breakdown, ahs, {
    useRoman,
  });
  const buffer = await wb.xlsx.writeBuffer();

  const filename = `RAB-${safeFilename(project.name)}-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
