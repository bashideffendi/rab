import ExcelJS from "exceljs";
import { terbilangRupiah } from "./terbilang";
import { computeRekap, BASIS_REGULASI } from "./rekap";

export type ExportProject = {
  name: string;
  opd: string | null;
  ownerName: string | null;
  status: string;
  notes: string | null;
  tahun: number | null;
  alamat: string | null;
  ppnPercent: string;
  overheadPercent: string;
  smkkPercent: string;
  dibulatkanKe: number;
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
  volumeFormula: string | null;
};

export type ExportBreakdownRow = {
  type: "tenaga" | "bahan" | "alat";
  name: string;
  unit: string;
  totalKebutuhan: number;
  hargaSatuan: number;
  totalBiaya: number;
};

export type ExportAhsComponent = {
  type: "tenaga" | "bahan" | "alat";
  name: string;
  unit: string;
  coefficient: number;
  hargaSatuan: number;
  subtotal: number;
};

export type ExportAhsItem = {
  itemNo: number;
  ahspCode: string | null;
  name: string;
  unit: string;
  volume: number;
  isCustom: boolean;
  customUnitPrice: number;
  components: ExportAhsComponent[];
  hsp: number;
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

function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  // Tabel greedy LENGKAP — dulu cuma s/d X → 40 jadi "XXXX" (gak valid). RAB
  // gedung bisa >10 divisi; sekarang valid sampai ribuan (40→XL, 49→XLIX).
  const map: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let r = "";
  let x = Math.floor(n);
  for (const [v, s] of map) {
    while (x >= v) {
      r += s;
      x -= v;
    }
  }
  return r;
}

function toLetter(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const x = Math.floor(n);
  if (x > 26) return String(x); // >Z → fallback angka, jangan '[' (charCode 91)
  return String.fromCharCode(64 + x); // 1 → A
}

/** Label WBS. useRoman: segmen-1 → Romawi (I/II/III), segmen-2 → huruf (A/B). */
function wbsLabel(
  code: string | null,
  name: string | null,
  useRoman = false,
): string {
  if (code === null) return "Tanpa WBS";
  let display = code;
  if (useRoman) {
    const segs = code.split(".");
    if (segs[0]) segs[0] = toRoman(Number(segs[0])) || segs[0];
    if (segs[1]) segs[1] = toLetter(Number(segs[1])) || segs[1];
    display = segs.join(".");
  }
  return `${display} — ${name ?? ""}`.trim();
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
const COLOR_HEADER_FG = "FFFFFFFF";
const COLOR_GROUP_BG = "FFFFF4E0";
const COLOR_GROUP_FG = "FFB35900";
const COLOR_SUBTOTAL_BG = "FFFAFAFA";
const COLOR_TOTAL_BG = "FFEA580C";
const COLOR_TOTAL_FG = "FFFFFFFF";
const COLOR_BORDER = "FFE4E4E7";

const thinBorder = {
  top: { style: "thin" as const, color: { argb: COLOR_BORDER } },
  bottom: { style: "thin" as const, color: { argb: COLOR_BORDER } },
  left: { style: "thin" as const, color: { argb: COLOR_BORDER } },
  right: { style: "thin" as const, color: { argb: COLOR_BORDER } },
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLOR_HEADER_FG } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_HEADER_BG },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  row.height = 20;
}

function addProjectMetaBlock(
  ws: ExcelJS.Worksheet,
  project: ExportProject,
  startRow = 1,
): number {
  ws.mergeCells(`A${startRow}:G${startRow}`);
  ws.getCell(`A${startRow}`).value = "RENCANA ANGGARAN BIAYA (RAB)";
  ws.getCell(`A${startRow}`).font = { bold: true, size: 14 };
  ws.getCell(`A${startRow}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  ws.getRow(startRow).height = 24;

  const fields: Array<[string, string]> = [
    ["Nama Project", project.name],
    ["Klien / Pemilik", project.opd ?? "-"],
    ["Penanggung Jawab", project.ownerName ?? "-"],
    ["Tahun", project.tahun?.toString() ?? "-"],
    ["Alamat", project.alamat ?? "-"],
    ["Status", project.status],
    [
      "Tanggal Export",
      new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    ],
  ];
  let row = startRow + 1;
  for (const [label, value] of fields) {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { bold: true, color: { argb: "FF666666" } };
    ws.getCell(`B${row}`).value = value;
    row++;
  }
  return row + 1; // blank row after
}

// ─── REKAP sheet ────────────────────────────────────────────────────────────
function buildRekapSheet(
  wb: ExcelJS.Workbook,
  project: ExportProject,
  items: ExportItem[],
  useRoman = false,
) {
  const ws = wb.addWorksheet("REKAP", {
    views: [{ state: "frozen", ySplit: 0 }],
  });
  ws.columns = [
    { width: 6 },
    { width: 38 },
    { width: 16 },
    { width: 8 },
    { width: 18 },
    { width: 22 },
    { width: 22 },
  ];

  const nextRow = addProjectMetaBlock(ws, project);

  // Header: section per WBS
  const groups = groupByWbs(items);
  const headerRow = nextRow;
  ws.getRow(headerRow).values = ["No", "Uraian Pekerjaan (WBS)", "", "", "", "", "Subtotal"];
  styleHeaderRow(ws.getRow(headerRow));

  let cursor = headerRow + 1;
  let no = 1;
  let subtotal = 0;
  for (const g of groups) {
    const label = wbsLabel(g.wbsCode, g.wbsName, useRoman);
    const r = ws.getRow(cursor);
    r.values = [no, label, "", "", "", "", g.subtotal];
    r.getCell(1).alignment = { horizontal: "center" };
    r.getCell(7).numFmt = '"Rp"#,##0';
    r.getCell(7).alignment = { horizontal: "right" };
    r.eachCell((c) => (c.border = thinBorder));
    cursor++;
    no++;
    subtotal += g.subtotal;
  }

  // Calc totals (shared computeRekap — sama persis dgn UI & print)
  const { overheadPct, overhead, smkkPct, smkk, ppnPct, ppn, dpp, total, dibulatkan } =
    computeRekap(subtotal, project);

  // Summary rows
  cursor++;
  const summaryRows: Array<[string, number, boolean]> = [
    [`Subtotal`, subtotal, false],
    [`Overhead (${overheadPct}%)`, overhead, false],
    [`SMKK (${smkkPct}%)`, smkk, false],
    [`Jumlah sebelum PPN`, dpp, false],
    [`PPN (${ppnPct}%)`, ppn, false],
    [`Total`, total, false],
    [`DIBULATKAN`, dibulatkan, true],
  ];
  for (const [label, value, emphasized] of summaryRows) {
    ws.mergeCells(`A${cursor}:F${cursor}`);
    ws.getCell(`A${cursor}`).value = label;
    ws.getCell(`A${cursor}`).alignment = { horizontal: "right" };
    if (emphasized)
      ws.getCell(`A${cursor}`).font = { bold: true, size: 12 };
    ws.getCell(`G${cursor}`).value = value;
    ws.getCell(`G${cursor}`).numFmt = '"Rp"#,##0';
    ws.getCell(`G${cursor}`).alignment = { horizontal: "right" };
    if (emphasized) {
      ws.getCell(`G${cursor}`).font = {
        bold: true,
        size: 12,
        color: { argb: COLOR_TOTAL_FG },
      };
      ws.getCell(`G${cursor}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_TOTAL_BG },
      };
      ws.getCell(`A${cursor}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_TOTAL_BG },
      };
      ws.getCell(`A${cursor}`).font = {
        bold: true,
        size: 12,
        color: { argb: COLOR_TOTAL_FG },
      };
    }
    cursor++;
  }

  // Terbilang
  cursor++;
  ws.mergeCells(`A${cursor}:G${cursor}`);
  ws.getCell(`A${cursor}`).value = `Terbilang: ${terbilangRupiah(dibulatkan)}`;
  ws.getCell(`A${cursor}`).font = { italic: true };

  // Basis perhitungan
  cursor++;
  ws.mergeCells(`A${cursor}:G${cursor}`);
  ws.getCell(`A${cursor}`).value = BASIS_REGULASI;
  ws.getCell(`A${cursor}`).font = {
    italic: true,
    size: 9,
    color: { argb: "FF888888" },
  };
}

// ─── RAB sheet (full items table) ───────────────────────────────────────────
function buildRabSheet(
  wb: ExcelJS.Workbook,
  project: ExportProject,
  items: ExportItem[],
  useRoman = false,
) {
  const ws = wb.addWorksheet("RAB", {
    views: [{ state: "frozen", ySplit: 9 }],
  });

  ws.columns = [
    { width: 6 },
    { width: 38 },
    { width: 12 },
    { width: 8 },
    { width: 16 },
    { width: 18 },
    { width: 30 },
  ];

  const nextRow = addProjectMetaBlock(ws, project);

  // Table header
  const headerRow = nextRow;
  ws.getRow(headerRow).values = [
    "No",
    "Uraian Pekerjaan",
    "Volume",
    "Sat",
    "Harga Satuan",
    "Total",
    "Sumber",
  ];
  styleHeaderRow(ws.getRow(headerRow));

  const groups = groupByWbs(items);
  let cursor = headerRow + 1;
  let itemNo = 1;
  let grandTotal = 0;

  for (const g of groups) {
    const groupLabel = wbsLabel(g.wbsCode, g.wbsName, useRoman);
    ws.mergeCells(`A${cursor}:G${cursor}`);
    const groupCell = ws.getCell(`A${cursor}`);
    groupCell.value = groupLabel;
    groupCell.font = { bold: true, color: { argb: COLOR_GROUP_FG } };
    groupCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_GROUP_BG },
    };
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
          ? `AHSP ${it.ahspCode}${it.ahspSourceDoc ? ` — ${it.ahspSourceDoc}` : ""}`
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
      row.eachCell((c) => {
        c.border = thinBorder;
        c.alignment = { ...c.alignment, vertical: "middle", wrapText: true };
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

  // Final totals block
  cursor++;
  const { overheadPct, overhead, smkkPct, smkk, ppnPct, ppn, total, dibulatkan } =
    computeRekap(grandTotal, project);

  const totalsRows: Array<[string, number, boolean]> = [
    ["Subtotal", grandTotal, false],
    [`Overhead (${overheadPct}%)`, overhead, false],
    [`SMKK (${smkkPct}%)`, smkk, false],
    [`PPN (${ppnPct}%)`, ppn, false],
    ["Total", total, false],
    ["DIBULATKAN", dibulatkan, true],
  ];
  for (const [label, value, emphasized] of totalsRows) {
    ws.mergeCells(`A${cursor}:E${cursor}`);
    ws.getCell(`A${cursor}`).value = label;
    ws.getCell(`A${cursor}`).alignment = { horizontal: "right" };
    if (emphasized)
      ws.getCell(`A${cursor}`).font = { bold: true, size: 12 };
    ws.getCell(`F${cursor}`).value = value;
    ws.getCell(`F${cursor}`).numFmt = '"Rp"#,##0';
    ws.getCell(`F${cursor}`).alignment = { horizontal: "right" };
    if (emphasized) {
      ws.getCell(`F${cursor}`).font = {
        bold: true,
        size: 12,
        color: { argb: COLOR_TOTAL_FG },
      };
      ws.getCell(`F${cursor}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_TOTAL_BG },
      };
      ws.getCell(`A${cursor}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_TOTAL_BG },
      };
      ws.getCell(`A${cursor}`).font = {
        bold: true,
        size: 12,
        color: { argb: COLOR_TOTAL_FG },
      };
    }
    cursor++;
  }

  cursor++;
  ws.mergeCells(`A${cursor}:G${cursor}`);
  ws.getCell(`A${cursor}`).value = `Terbilang: ${terbilangRupiah(dibulatkan)}`;
  ws.getCell(`A${cursor}`).font = { italic: true };
}

// ─── Breakdown sheets (Upah / Bahan / Alat) ─────────────────────────────────
const TYPE_TITLES = {
  tenaga: "UPAH / TENAGA KERJA",
  bahan: "BAHAN / MATERIAL",
  alat: "PERALATAN",
} as const;

function buildBreakdownSheet(
  wb: ExcelJS.Workbook,
  type: "tenaga" | "bahan" | "alat",
  rows: ExportBreakdownRow[],
) {
  const sheetName =
    type === "tenaga" ? "Upah" : type === "bahan" ? "Bahan" : "Alat";
  const ws = wb.addWorksheet(sheetName);

  ws.columns = [
    { width: 6 },
    { width: 40 },
    { width: 18 },
    { width: 10 },
    { width: 18 },
    { width: 22 },
  ];

  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = TYPE_TITLES[type];
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };
  ws.getRow(1).height = 24;

  ws.getRow(3).values = [
    "No",
    "Nama",
    "Total Kebutuhan",
    "Sat",
    "Harga Satuan",
    "Total Biaya",
  ];
  styleHeaderRow(ws.getRow(3));

  const filtered = rows.filter((r) => r.type === type);
  let cursor = 4;
  let total = 0;
  let no = 1;
  for (const r of filtered) {
    const row = ws.getRow(cursor);
    row.values = [
      no,
      r.name,
      r.totalKebutuhan,
      r.unit,
      r.hargaSatuan,
      r.totalBiaya,
    ];
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(3).numFmt = "#,##0.####";
    row.getCell(3).alignment = { horizontal: "right" };
    row.getCell(4).alignment = { horizontal: "center" };
    row.getCell(5).numFmt = '"Rp"#,##0';
    row.getCell(5).alignment = { horizontal: "right" };
    row.getCell(6).numFmt = '"Rp"#,##0';
    row.getCell(6).alignment = { horizontal: "right" };
    row.getCell(6).font = { bold: true };
    row.eachCell((c) => (c.border = thinBorder));
    total += r.totalBiaya;
    no++;
    cursor++;
  }

  // Total row
  ws.mergeCells(`A${cursor}:E${cursor}`);
  ws.getCell(`A${cursor}`).value = `Total ${TYPE_TITLES[type]}`;
  ws.getCell(`A${cursor}`).font = { bold: true, size: 11 };
  ws.getCell(`A${cursor}`).alignment = { horizontal: "right" };
  ws.getCell(`A${cursor}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLOR_TOTAL_BG },
  };
  ws.getCell(`A${cursor}`).font = {
    bold: true,
    size: 11,
    color: { argb: COLOR_TOTAL_FG },
  };
  ws.getCell(`F${cursor}`).value = total;
  ws.getCell(`F${cursor}`).numFmt = '"Rp"#,##0';
  ws.getCell(`F${cursor}`).font = {
    bold: true,
    size: 11,
    color: { argb: COLOR_TOTAL_FG },
  };
  ws.getCell(`F${cursor}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLOR_TOTAL_BG },
  };
}

// ─── AHS sheet (Analisa Harga Satuan per item) ──────────────────────────────
const AHS_TYPE_LABEL: Record<"tenaga" | "bahan" | "alat", string> = {
  tenaga: "A. Tenaga Kerja",
  bahan: "B. Bahan",
  alat: "C. Peralatan",
};

function buildAhsSheet(wb: ExcelJS.Workbook, ahs: ExportAhsItem[]) {
  if (ahs.length === 0) return;
  const ws = wb.addWorksheet("AHS");
  ws.columns = [
    { width: 6 },
    { width: 44 },
    { width: 12 },
    { width: 8 },
    { width: 18 },
    { width: 22 },
  ];

  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = "ANALISA HARGA SATUAN PEKERJAAN (AHS)";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };
  ws.getRow(1).height = 24;

  ws.getRow(3).values = ["No", "Uraian", "Koef.", "Sat", "Harga Satuan", "Jumlah"];
  styleHeaderRow(ws.getRow(3));

  const rp = '"Rp"#,##0';
  let cursor = 4;

  for (const item of ahs) {
    ws.mergeCells(`A${cursor}:F${cursor}`);
    const hc = ws.getCell(`A${cursor}`);
    hc.value = `${item.itemNo}.  ${item.ahspCode ? item.ahspCode + "  " : ""}${item.name}  —  Vol ${item.volume.toLocaleString("id-ID")} ${item.unit}`;
    hc.font = { bold: true, color: { argb: COLOR_GROUP_FG } };
    hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_GROUP_BG } };
    cursor++;

    if (item.isCustom || item.components.length === 0) {
      const r = ws.getRow(cursor);
      r.values = ["", "Harga satuan custom (tanpa rincian komponen)", "", "", "", item.hsp];
      r.getCell(6).numFmt = rp;
      r.getCell(6).alignment = { horizontal: "right" };
      r.eachCell((c) => (c.border = thinBorder));
      cursor += 2;
      continue;
    }

    for (const type of ["tenaga", "bahan", "alat"] as const) {
      const comps = item.components.filter((c) => c.type === type);
      if (comps.length === 0) continue;
      ws.getCell(`A${cursor}`).value = AHS_TYPE_LABEL[type];
      ws.getCell(`A${cursor}`).font = { italic: true, bold: true, size: 10 };
      cursor++;
      let no = 1;
      let sub = 0;
      for (const c of comps) {
        const r = ws.getRow(cursor);
        r.values = [no, c.name, c.coefficient, c.unit, c.hargaSatuan, c.subtotal];
        r.getCell(1).alignment = { horizontal: "center" };
        r.getCell(3).numFmt = "#,##0.######";
        r.getCell(3).alignment = { horizontal: "right" };
        r.getCell(4).alignment = { horizontal: "center" };
        r.getCell(5).numFmt = rp;
        r.getCell(5).alignment = { horizontal: "right" };
        r.getCell(6).numFmt = rp;
        r.getCell(6).alignment = { horizontal: "right" };
        r.eachCell((cc) => (cc.border = thinBorder));
        sub += c.subtotal;
        no++;
        cursor++;
      }
      ws.mergeCells(`A${cursor}:E${cursor}`);
      ws.getCell(`A${cursor}`).value = `Jumlah ${AHS_TYPE_LABEL[type]}`;
      ws.getCell(`A${cursor}`).alignment = { horizontal: "right" };
      ws.getCell(`A${cursor}`).font = { italic: true };
      ws.getCell(`F${cursor}`).value = sub;
      ws.getCell(`F${cursor}`).numFmt = rp;
      ws.getCell(`F${cursor}`).alignment = { horizontal: "right" };
      cursor++;
    }

    ws.mergeCells(`A${cursor}:E${cursor}`);
    const hsp = ws.getCell(`A${cursor}`);
    hsp.value = "Harga Satuan Pekerjaan (HSP)";
    hsp.alignment = { horizontal: "right" };
    hsp.font = { bold: true, color: { argb: COLOR_TOTAL_FG } };
    hsp.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL_BG } };
    const hspV = ws.getCell(`F${cursor}`);
    hspV.value = item.hsp;
    hspV.numFmt = rp;
    hspV.alignment = { horizontal: "right" };
    hspV.font = { bold: true, color: { argb: COLOR_TOTAL_FG } };
    hspV.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL_BG } };
    cursor += 2;
  }
}

// ─── Backup Volume sheet (dasar perhitungan volume) ─────────────────────────
function buildBackupVolumeSheet(wb: ExcelJS.Workbook, items: ExportItem[]) {
  if (items.length === 0) return;
  const ws = wb.addWorksheet("Backup Volume");
  ws.columns = [
    { width: 6 },
    { width: 44 },
    { width: 50 },
    { width: 8 },
    { width: 16 },
  ];

  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = "BACKUP PERHITUNGAN VOLUME";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };
  ws.getRow(1).height = 24;

  ws.getRow(3).values = ["No", "Uraian Pekerjaan", "Dimensi / Rumus", "Sat", "Volume"];
  styleHeaderRow(ws.getRow(3));

  const groups = groupByWbs(items);
  let cursor = 4;
  let no = 1;
  for (const g of groups) {
    ws.mergeCells(`A${cursor}:E${cursor}`);
    const gc = ws.getCell(`A${cursor}`);
    gc.value = wbsLabel(g.wbsCode, g.wbsName);
    gc.font = { bold: true, color: { argb: COLOR_GROUP_FG } };
    gc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_GROUP_BG } };
    cursor++;
    for (const it of g.items) {
      const r = ws.getRow(cursor);
      r.values = [
        no,
        it.name,
        it.volumeFormula ?? "— (volume manual)",
        it.unit,
        Number(it.volume) || 0,
      ];
      r.getCell(1).alignment = { horizontal: "center" };
      r.getCell(3).alignment = { wrapText: true };
      r.getCell(4).alignment = { horizontal: "center" };
      r.getCell(5).numFmt = "#,##0.####";
      r.getCell(5).alignment = { horizontal: "right" };
      r.eachCell((c) => (c.border = thinBorder));
      no++;
      cursor++;
    }
  }
}

// ─── Main entry ─────────────────────────────────────────────────────────────
export async function buildProjectWorkbook(
  project: ExportProject,
  items: ExportItem[],
  breakdown: ExportBreakdownRow[],
  ahs: ExportAhsItem[] = [],
  opts: { useRoman?: boolean } = {},
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RABin";
  wb.created = new Date();
  const useRoman = opts.useRoman ?? false;

  buildRekapSheet(wb, project, items, useRoman);
  buildRabSheet(wb, project, items, useRoman);
  buildAhsSheet(wb, ahs);
  buildBackupVolumeSheet(wb, items);
  if (breakdown.some((r) => r.type === "tenaga"))
    buildBreakdownSheet(wb, "tenaga", breakdown);
  if (breakdown.some((r) => r.type === "bahan"))
    buildBreakdownSheet(wb, "bahan", breakdown);
  if (breakdown.some((r) => r.type === "alat"))
    buildBreakdownSheet(wb, "alat", breakdown);

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
