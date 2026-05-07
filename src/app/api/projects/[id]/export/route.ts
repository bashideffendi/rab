import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  buildProjectWorkbook,
  safeFilename,
  type ExportItem,
  type ExportProject,
} from "@/lib/excel-export";
import { getCurrentUser, verifyProjectOwnership } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function loadProject(id: string): Promise<ExportProject | null> {
  const rows = await db
    .select({
      name: schema.projects.name,
      opd: schema.projects.opd,
      ownerName: schema.projects.ownerName,
      status: schema.projects.status,
      notes: schema.projects.notes,
    })
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .limit(1);
  return rows[0] ?? null;
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

  let project: ExportProject | null = null;
  let items: ExportItem[] = [];
  try {
    [project, items] = await Promise.all([loadProject(id), loadItems(id)]);
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

  const wb = await buildProjectWorkbook(project, items);
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
