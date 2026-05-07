import ExcelJS from "exceljs";

export type ExportProject = {
  name: string;
  opd: string | null;
  ownerName: string | null;
  status: string;
  notes: string | null;
};

export type ExportItem = {
  wbsCode: string | null;
  wbsName: string | null;
  name: string;
  unit: string;
  volume: string;
  unitPrice: string;
  ahspCode: string | null;
  ahspSourceDoc: string | null;
};

type Group = {
  wbsCode: string | null;
  wbsName: string | null;
  items: ExportItem[];
  subtotal: number;
};

function calcTotal(volume: string, unitPrice: string): number {
  const v = Number(volume);
  const p = Number(unitPrice);
  if (!Number.isFinite(v) || !Number.isFinite(p)) return 0;
  return v * p;
}

function sortByCode(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const ap = a.split(".").map(Number);
  const bp = b.split(".").map(Number);
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function groupByWbs(items: ExportItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const key = it.wbsCode ?? "__no_wbs__";
    let g = map.get(key);
    if (!g) {
      g = {
        wbsCode: it.wbsCode,
        wbsName: it.wbsName,
        items: [],
        subtotal: 0,
      };
      map.set(key, g);
    }
    g.items.push(it);
    g.subtotal += calcTotal(it.volume, it.unitPrice);
  }
  return Array.from(map.values()).sort((a, b) =>
    sortByCode(a.wbsCode, b.wbsCode),
  );
}

const COLOR_HEADER_BG = "FF1A1A1A";
const COLOR_HEADER_FG = "FFEDEDED";
const COLOR_GROUP_BG = "FFFFF4E0";
const COLOR_GROUP_FG = "FFB35900";
const COLOR_SUBTOTAL_BG = "FFFAFAFA";
const COLOR_TOTAL_BG = "FFF5A623";
const COLOR_TOTAL_FG = "FF000000";
const COLOR_BORDER = "FFE0E0E0";

const thinBorder = {
  top: { style: "thin" as const, color: { argb: COLOR_BORDER } },
  bottom: { style: "thin" as const, color: { argb: COLOR_BORDER } },
  left: { style: "thin" as const, color: { argb: COLOR_BORDER } },
  right: { style: "thin" as const, color: { argb: COLOR_BORDER } },
};

export async function buildProjectWorkbook(
  project: ExportProject,
  items: ExportItem[],
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RABin";
  wb.created = new Date();

  const ws = wb.addWorksheet("RAB", {
    views: [{ state: "frozen", ySplit: 8 }],
  });

  // Column widths
  ws.columns = [
    { width: 6 }, // No
    { width: 38 }, // Pekerjaan
    { width: 12 }, // Volume
    { width: 8 }, // Sat
    { width: 16 }, // Harga Sat
    { width: 18 }, // Total
    { width: 30 }, // Sumber AHSP
  ];

  // ─── Header block ────────────────────────────────────────────────────────
  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = "RENCANA ANGGARAN BIAYA (RAB)";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.getCell("A2").value = "Nama Project";
  ws.getCell("B2").value = project.name;
  ws.getCell("A3").value = "Klien / Pemilik";
  ws.getCell("B3").value = project.opd ?? "-";
  ws.getCell("A4").value = "Penanggung Jawab";
  ws.getCell("B4").value = project.ownerName ?? "-";
  ws.getCell("A5").value = "Status";
  ws.getCell("B5").value = project.status;
  ws.getCell("A6").value = "Tanggal Export";
  ws.getCell("B6").value = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  for (let r = 2; r <= 6; r++) {
    ws.getCell(`A${r}`).font = { bold: true, color: { argb: "FF666666" } };
  }

  // ─── Table header ────────────────────────────────────────────────────────
  const headerRow = 8;
  const headers = [
    "No",
    "Uraian Pekerjaan",
    "Volume",
    "Sat",
    "Harga Satuan",
    "Total",
    "Sumber",
  ];
  ws.getRow(headerRow).values = headers;
  ws.getRow(headerRow).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLOR_HEADER_FG } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_HEADER_BG },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  ws.getRow(headerRow).height = 22;

  // ─── Body grouped by WBS ─────────────────────────────────────────────────
  const groups = groupByWbs(items);
  let cursor = headerRow + 1;
  let itemNo = 1;
  let grandTotal = 0;

  for (const g of groups) {
    // Group header row
    const groupLabel =
      g.wbsCode === null
        ? "Tanpa WBS"
        : `${g.wbsCode} — ${g.wbsName ?? ""}`.trim();
    ws.mergeCells(`A${cursor}:G${cursor}`);
    const groupCell = ws.getCell(`A${cursor}`);
    groupCell.value = groupLabel;
    groupCell.font = { bold: true, color: { argb: COLOR_GROUP_FG } };
    groupCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_GROUP_BG },
    };
    groupCell.alignment = { horizontal: "left", vertical: "middle" };
    groupCell.border = thinBorder;
    cursor++;

    for (const it of g.items) {
      const total = calcTotal(it.volume, it.unitPrice);
      grandTotal += total;

      const row = ws.getRow(cursor);
      row.values = [
        itemNo,
        it.name,
        Number(it.volume),
        it.unit,
        Number(it.unitPrice),
        total,
        it.ahspCode
          ? `AHSP ${it.ahspCode}${
              it.ahspSourceDoc ? ` — ${it.ahspSourceDoc}` : ""
            }`
          : "Custom",
      ];
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(3).numFmt = "#,##0.##";
      row.getCell(3).alignment = { horizontal: "right" };
      row.getCell(4).alignment = { horizontal: "center" };
      row.getCell(5).numFmt = '"Rp"#,##0';
      row.getCell(5).alignment = { horizontal: "right" };
      row.getCell(6).numFmt = '"Rp"#,##0';
      row.getCell(6).alignment = { horizontal: "right" };
      row.getCell(6).font = { bold: true };
      row.getCell(7).font = { color: { argb: "FF888888" }, size: 9 };
      row.eachCell((cell) => {
        cell.border = thinBorder;
        cell.alignment = { ...cell.alignment, vertical: "middle", wrapText: true };
      });
      itemNo++;
      cursor++;
    }

    // Subtotal row
    const subRow = ws.getRow(cursor);
    subRow.values = [
      "",
      "",
      "",
      "",
      `Subtotal ${g.wbsCode ?? "tanpa WBS"}`,
      g.subtotal,
      "",
    ];
    subRow.getCell(5).font = { italic: true, color: { argb: "FF666666" } };
    subRow.getCell(5).alignment = { horizontal: "right" };
    subRow.getCell(6).numFmt = '"Rp"#,##0';
    subRow.getCell(6).font = { italic: true, bold: true };
    subRow.getCell(6).alignment = { horizontal: "right" };
    subRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_SUBTOTAL_BG },
      };
      cell.border = thinBorder;
    });
    cursor++;
  }

  // ─── Grand total ─────────────────────────────────────────────────────────
  cursor++;
  const totalRow = ws.getRow(cursor);
  totalRow.values = ["", "", "", "", "GRAND TOTAL", grandTotal, ""];
  totalRow.getCell(5).font = {
    bold: true,
    size: 12,
    color: { argb: COLOR_TOTAL_FG },
  };
  totalRow.getCell(5).alignment = { horizontal: "right" };
  totalRow.getCell(6).numFmt = '"Rp"#,##0';
  totalRow.getCell(6).font = {
    bold: true,
    size: 12,
    color: { argb: COLOR_TOTAL_FG },
  };
  totalRow.getCell(6).alignment = { horizontal: "right" };
  totalRow.eachCell((cell, colNumber) => {
    if (colNumber === 5 || colNumber === 6) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_TOTAL_BG },
      };
    }
    cell.border = {
      top: { style: "medium" as const, color: { argb: "FF000000" } },
      bottom: { style: "medium" as const, color: { argb: "FF000000" } },
      left: thinBorder.left,
      right: thinBorder.right,
    };
  });
  totalRow.height = 28;

  // ─── Footer note ─────────────────────────────────────────────────────────
  cursor += 2;
  ws.mergeCells(`A${cursor}:G${cursor}`);
  ws.getCell(`A${cursor}`).value = `Generated by RABin · ${new Date().toLocaleString("id-ID")}`;
  ws.getCell(`A${cursor}`).font = {
    italic: true,
    size: 9,
    color: { argb: "FF999999" },
  };
  ws.getCell(`A${cursor}`).alignment = { horizontal: "right" };

  if (project.notes) {
    cursor++;
    ws.mergeCells(`A${cursor}:G${cursor}`);
    ws.getCell(`A${cursor}`).value = `Catatan: ${project.notes}`;
    ws.getCell(`A${cursor}`).font = { italic: true, size: 9 };
    ws.getCell(`A${cursor}`).alignment = { wrapText: true };
  }

  return wb;
}

export function safeFilename(name: string): string {
  return (
    name
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "rab"
  );
}
