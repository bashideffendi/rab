import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { db, schema } from "@/db";
import {
  buildProjectWorkbook,
  safeFilename,
  type ExportBreakdownRow,
  type ExportItem,
  type ExportProject,
} from "@/lib/excel-export";
import { getCurrentUser, verifyProjectOwnership } from "@/lib/auth";

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
  const aggRows = await db
    .select({
      materialId: schema.materials.id,
      name: schema.materials.name,
      type: schema.materials.type,
      unit: schema.materials.unit,
      coefficient: schema.ahspComponents.coefficient,
      itemVolume: schema.projectItems.volume,
    })
    .from(schema.projectItems)
    .innerJoin(
      schema.ahspComponents,
      eq(schema.ahspComponents.ahspItemId, schema.projectItems.ahspItemId),
    )
    .innerJoin(
      schema.materials,
      eq(schema.materials.id, schema.ahspComponents.materialId),
    )
    .where(eq(schema.projectItems.projectId, projectId));

  const map = new Map<string, ExportBreakdownRow & { materialId: string }>();
  for (const r of aggRows) {
    const koef = Number(r.coefficient);
    const vol = Number(r.itemVolume);
    if (!Number.isFinite(koef) || !Number.isFinite(vol)) continue;
    const kebutuhan = koef * vol;
    let m = map.get(r.materialId);
    if (!m) {
      m = {
        materialId: r.materialId,
        type: r.type,
        name: r.name,
        unit: r.unit,
        totalKebutuhan: 0,
        hargaSatuan: 0,
        totalBiaya: 0,
      };
      map.set(r.materialId, m);
    }
    m.totalKebutuhan += kebutuhan;
  }

  if (map.size === 0) return [];
  const matIds = Array.from(map.keys());
  const today = new Date().toISOString().slice(0, 10);
  const prices = await db
    .select({
      materialId: schema.materialPrices.materialId,
      price: schema.materialPrices.price,
      regionId: schema.materialPrices.regionId,
      validFrom: schema.materialPrices.validFrom,
    })
    .from(schema.materialPrices)
    .where(
      and(
        inArray(schema.materialPrices.materialId, matIds),
        lte(schema.materialPrices.validFrom, today),
        or(
          isNull(schema.materialPrices.validTo),
          gte(schema.materialPrices.validTo, today),
        ),
      ),
    )
    .orderBy(desc(schema.materialPrices.validFrom));

  const priceByMat = new Map<string, number>();
  for (const p of prices) {
    if (priceByMat.has(p.materialId)) continue;
    if (regionId && p.regionId !== regionId && p.regionId !== null) continue;
    priceByMat.set(p.materialId, Number(p.price));
  }
  for (const p of prices) {
    if (!priceByMat.has(p.materialId)) {
      priceByMat.set(p.materialId, Number(p.price));
    }
  }
  for (const m of map.values()) {
    m.hargaSatuan = priceByMat.get(m.materialId) ?? 0;
    m.totalBiaya = m.hargaSatuan * m.totalKebutuhan;
  }

  return Array.from(map.values()).map(({ materialId: _id, ...rest }) => rest);
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
      ahspSourceDoc: schema.ahspItems.sourceDoc,
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
    name: r.customName ?? "(custom item)",
    unit: r.customUnit ?? "",
    volume: r.volume,
    unitPrice: r.customUnitPrice ?? "0",
    ahspCode: r.ahspCode,
    ahspSourceDoc: r.ahspSourceDoc,
  }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

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
  try {
    project = await loadProject(id);
    items = await loadItems(id);
    if (project) {
      breakdown = await loadBreakdown(id, project.regionId);
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

  const wb = await buildProjectWorkbook(project, items, breakdown);
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
