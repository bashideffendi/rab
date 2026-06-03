import { and, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { parseSheet } from "@/lib/excel-import-parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/projects/[id]/import-excel
 * Parse .xlsx (multipart 'file'), return baris {name,unit,volume,unitPrice}.
 * Tidak menyimpan apa pun — preview only. Commit lewat server action.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id: projectId } = await params;

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
    return Response.json({ error: "Project tidak ditemukan." }, { status: 404 });
  }

  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) {
      return Response.json({ error: "File tidak ditemukan." }, { status: 400 });
    }
    file = f;
  } catch {
    return Response.json({ error: "Gagal parsing form-data." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Ukuran file maksimal 5 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  try {
    // cast: friksi tipe Buffer generic @types/node 20 vs exceljs
    await wb.xlsx.load(
      buffer as unknown as Parameters<typeof wb.xlsx.load>[0],
    );
  } catch {
    return Response.json({ error: "File bukan .xlsx yang valid." }, { status: 400 });
  }
  const ws = wb.worksheets[0];
  if (!ws) {
    return Response.json({ error: "Workbook tidak punya sheet." }, { status: 400 });
  }

  const { rows, warnings, headerRow } = parseSheet(ws);
  if (headerRow === -1) {
    return Response.json(
      {
        error:
          "Header tidak ketemu. Pastikan ada kolom: Nama/Uraian, Satuan, Volume, Harga Satuan.",
      },
      { status: 400 },
    );
  }
  return Response.json({ rows, warnings });
}
