import type ExcelJS from "exceljs";

export type ImportRow = {
  name: string;
  unit: string;
  volume: number;
  unitPrice: number;
};

type Field = "name" | "unit" | "volume" | "unitPrice";

// Header kolom fleksibel (lowercase, trimmed).
const HEADER_MAP: Record<string, Field> = {
  nama: "name",
  "nama pekerjaan": "name",
  uraian: "name",
  "uraian pekerjaan": "name",
  pekerjaan: "name",
  satuan: "unit",
  sat: "unit",
  unit: "unit",
  volume: "volume",
  vol: "volume",
  "vol.": "volume",
  qty: "volume",
  harga: "unitPrice",
  "harga satuan": "unitPrice",
  "harga sat": "unitPrice",
  "harga sat.": "unitPrice",
  "harga/sat": "unitPrice",
};

/**
 * Konversi cell ke angka, tahan format id-ID. Aturan:
 *  - cell numeric / formula-result numeric → langsung.
 *  - string: strip non-[digit . , -]. Kalau hasil kosong → NaN (bukan 0).
 *  - ada koma → koma = desimal, titik = ribuan ("1.250,00" → 1250).
 *  - tanpa koma tapi pola ribuan murni ("85.000", "1.250.000") → titik dibuang.
 *  - selain itu titik tunggal dianggap desimal ("3.2" → 3.2).
 */
export function numFromCell(cell: ExcelJS.Cell): number {
  const v = cell.value;
  if (typeof v === "number") return v;
  if (
    v &&
    typeof v === "object" &&
    "result" in v &&
    typeof (v as { result: unknown }).result === "number"
  ) {
    return (v as { result: number }).result;
  }
  const s = cell.text.trim();
  if (!s) return NaN;
  let t = s.replace(/[^\d.,-]/g, "");
  if (!t) return NaN;
  if (t.includes(",")) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Parse worksheet pertama jadi baris RAB. Deteksi baris header (≥2 kolom
 * dikenali & ada kolom nama), lalu baca baris di bawahnya. headerRow = -1
 * kalau header gak ketemu.
 */
export function parseSheet(ws: ExcelJS.Worksheet): {
  rows: ImportRow[];
  warnings: string[];
  headerRow: number;
} {
  let headerRow = -1;
  const colMap = new Map<number, Field>();
  ws.eachRow((row, rowNum) => {
    if (headerRow !== -1) return;
    const found = new Map<number, Field>();
    row.eachCell((cell, colNum) => {
      const key = cell.text.toLowerCase().trim();
      const mapped = HEADER_MAP[key];
      if (mapped && ![...found.values()].includes(mapped)) {
        found.set(colNum, mapped);
      }
    });
    if (found.size >= 2 && [...found.values()].includes("name")) {
      headerRow = rowNum;
      for (const [c, f] of found) colMap.set(c, f);
    }
  });

  const rows: ImportRow[] = [];
  const warnings: string[] = [];
  if (headerRow === -1) return { rows, warnings, headerRow };

  const colFor = (field: Field): number | null => {
    for (const [c, f] of colMap) if (f === field) return c;
    return null;
  };
  const cName = colFor("name");
  const cUnit = colFor("unit");
  const cVol = colFor("volume");
  const cPrice = colFor("unitPrice");

  ws.eachRow((row, rowNum) => {
    if (rowNum <= headerRow) return;
    const name = cName ? row.getCell(cName).text.trim() : "";
    if (!name) return;
    const unit = cUnit ? row.getCell(cUnit).text.trim() || "ls" : "ls";
    const volume = cVol ? numFromCell(row.getCell(cVol)) : NaN;
    const unitPrice = cPrice ? numFromCell(row.getCell(cPrice)) : NaN;
    if (
      !Number.isFinite(volume) ||
      volume < 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      warnings.push(`Baris ${rowNum} "${name}" dilewati — volume/harga bukan angka.`);
      return;
    }
    rows.push({
      name: name.slice(0, 200),
      unit: unit.slice(0, 30),
      volume,
      unitPrice,
    });
  });

  return { rows, warnings, headerRow };
}
