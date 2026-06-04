import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { loadBreakdownRows } from "@/lib/breakdown";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatIDR, formatDate } from "@/lib/utils";
import { terbilangRupiah } from "@/lib/terbilang";
import { computeRekap, BASIS_REGULASI } from "@/lib/rekap";

export const dynamic = "force-dynamic";

type ItemRow = {
  id: string;
  wbsCode: string | null;
  wbsName: string | null;
  name: string;
  unit: string;
  volume: string;
  unitPrice: string;
  ahspCode: string | null;
};

type BreakdownRow = {
  type: "tenaga" | "bahan" | "alat";
  name: string;
  unit: string;
  totalKebutuhan: number;
  hargaSatuan: number;
  totalBiaya: number;
};

async function loadProjectFull(id: string, userId: string) {
  const rows = await db
    .select({
      project: schema.projects,
      regionName: schema.regions.name,
    })
    .from(schema.projects)
    .leftJoin(schema.regions, eq(schema.regions.id, schema.projects.regionId))
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)))
    .limit(1);
  return rows[0]
    ? { ...rows[0].project, regionName: rows[0].regionName }
    : null;
}

async function loadItems(projectId: string): Promise<ItemRow[]> {
  const rows = await db
    .select({
      id: schema.projectItems.id,
      wbsCode: schema.wbsItems.code,
      wbsName: schema.wbsItems.name,
      customName: schema.projectItems.customName,
      customUnit: schema.projectItems.customUnit,
      volume: schema.projectItems.volume,
      customUnitPrice: schema.projectItems.customUnitPrice,
      ahspCode: schema.ahspItems.code,
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
    id: r.id,
    wbsCode: r.wbsCode,
    wbsName: r.wbsName,
    name: r.customName ?? "(custom)",
    unit: r.customUnit ?? "",
    volume: r.volume,
    unitPrice: r.customUnitPrice ?? "0",
    ahspCode: r.ahspCode,
  }));
}

async function loadBreakdown(
  projectId: string,
  regionId: string | null,
): Promise<BreakdownRow[]> {
  // Delegasi ke helper bersama (region-aware IKK + sanity-gate) — angka sama
  // persis dgn sheet export & halaman /breakdown, rekonsiliasi ke subtotal RAB.
  const rows = await loadBreakdownRows(projectId, regionId);
  return rows.map(({ materialId: _id, ...r }) => r);
}

function calcItemTotal(item: ItemRow): number {
  return Number(item.volume) * Number(item.unitPrice);
}

function sortByCode(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const ap = a.split(".").map(Number);
  const bp = b.split(".").map(Number);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const project = await loadProjectFull(id, user.id);
  if (!project) notFound();

  const [items, breakdown] = await Promise.all([
    loadItems(project.id),
    loadBreakdown(project.id, project.regionId),
  ]);

  // Group items by WBS
  const groupMap = new Map<string, { code: string | null; name: string | null; items: ItemRow[]; subtotal: number }>();
  for (const it of items) {
    const key = it.wbsCode ?? "__no_wbs__";
    let g = groupMap.get(key);
    if (!g) {
      g = { code: it.wbsCode, name: it.wbsName, items: [], subtotal: 0 };
      groupMap.set(key, g);
    }
    g.items.push(it);
    g.subtotal += calcItemTotal(it);
  }
  const groups = Array.from(groupMap.values()).sort((a, b) =>
    sortByCode(a.code, b.code),
  );

  const subtotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const { overheadPct, overhead, smkkPct, smkk, ppnPct, ppn, total, dibulatkan } =
    computeRekap(subtotal, {
      overheadPercent: project.overheadPercent,
      smkkPercent: project.smkkPercent,
      ppnPercent: project.ppnPercent,
      dibulatkanKe: project.dibulatkanKe,
    });

  const tenaga = breakdown.filter((b) => b.type === "tenaga");
  const bahan = breakdown.filter((b) => b.type === "bahan");
  const alat = breakdown.filter((b) => b.type === "alat");

  return (
    <>
      <PrintStyles />
      <div className="print-toolbar no-print">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Tampilan ramah-cetak. Tekan{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">
              Ctrl/⌘ + P
            </kbd>{" "}
            untuk simpan sebagai PDF.
          </p>
          <button
            type="button"
            onClick={undefined}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            <a
              href="javascript:window.print()"
              style={{ color: "white", textDecoration: "none" }}
            >
              ↓ Cetak / PDF
            </a>
          </button>
        </div>
      </div>

      <main className="print-main mx-auto max-w-4xl px-8 py-10 text-sm text-foreground">
        {/* === Header === */}
        <header className="mb-8 border-b-2 border-foreground pb-4">
          <h1 className="text-center text-2xl font-bold">
            RENCANA ANGGARAN BIAYA
          </h1>
          <p className="text-center text-base font-semibold mt-1">
            {project.name}
          </p>
        </header>

        <table className="mb-6 w-full text-sm">
          <tbody>
            <Row label="Klien / Pemilik" value={project.opd} />
            <Row label="Penanggung Jawab" value={project.ownerName} />
            <Row label="Lokasi" value={project.regionName} />
            <Row label="Alamat" value={project.alamat} />
            <Row label="Tahun" value={project.tahun?.toString() ?? null} />
            <Row label="Tanggal Cetak" value={formatDate(new Date())} />
          </tbody>
        </table>

        {/* === REKAP === */}
        <section className="mb-8 page-break-after">
          <h2 className="mb-3 text-lg font-bold">REKAPITULASI</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-100">
                <th className="border border-foreground px-2 py-2 text-left">No</th>
                <th className="border border-foreground px-2 py-2 text-left">Uraian Pekerjaan</th>
                <th className="border border-foreground px-2 py-2 text-right">Jumlah Harga</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => (
                <tr key={g.code ?? "no-wbs"}>
                  <td className="border border-foreground px-2 py-1.5 text-center">
                    {i + 1}
                  </td>
                  <td className="border border-foreground px-2 py-1.5">
                    {g.code ? `${g.code} — ` : ""}{g.name ?? "Tanpa WBS"}
                  </td>
                  <td className="border border-foreground px-2 py-1.5 text-right tabular-nums">
                    {formatIDR(g.subtotal)}
                  </td>
                </tr>
              ))}
              <SummaryRow label="Subtotal" value={subtotal} />
              {overheadPct > 0 && (
                <SummaryRow
                  label={`Overhead (${overheadPct}%)`}
                  value={overhead}
                />
              )}
              {smkkPct > 0 && (
                <SummaryRow label={`SMKK (${smkkPct}%)`} value={smkk} />
              )}
              <SummaryRow label={`PPN (${ppnPct}%)`} value={ppn} />
              <SummaryRow label="Total" value={total} bold />
              <SummaryRow label="DIBULATKAN" value={dibulatkan} bold accent />
            </tbody>
          </table>
          <p className="mt-3 text-sm italic">
            Terbilang: <span className="not-italic">{terbilangRupiah(dibulatkan)}</span>
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">{BASIS_REGULASI}</p>
        </section>

        {/* === RAB Detail === */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">RINCIAN RAB</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100">
                <th className="border border-foreground px-2 py-2 w-8">No</th>
                <th className="border border-foreground px-2 py-2 text-left">Uraian Pekerjaan</th>
                <th className="border border-foreground px-2 py-2 w-16 text-right">Volume</th>
                <th className="border border-foreground px-2 py-2 w-12">Sat</th>
                <th className="border border-foreground px-2 py-2 w-24 text-right">Harga Sat</th>
                <th className="border border-foreground px-2 py-2 w-28 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Section key={g.code ?? "no-wbs"} group={g} />
              ))}
            </tbody>
          </table>
        </section>

        {/* === Breakdown === */}
        {breakdown.length > 0 && (
          <section className="mb-8 page-break-before">
            <h2 className="mb-3 text-lg font-bold">
              BREAKDOWN MATERIAL & TENAGA
            </h2>
            {tenaga.length > 0 && (
              <BreakdownTable title="A. Upah / Tenaga Kerja" rows={tenaga} />
            )}
            {bahan.length > 0 && (
              <BreakdownTable title="B. Bahan / Material" rows={bahan} />
            )}
            {alat.length > 0 && (
              <BreakdownTable title="C. Peralatan" rows={alat} />
            )}
          </section>
        )}

        <footer className="mt-12 border-t border-foreground/30 pt-3 text-center text-xs text-muted-foreground">
          Generated by RABin · rabin.masbash.id · {new Date().toLocaleString("id-ID")}
        </footer>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <tr>
      <td className="w-44 py-1 align-top font-semibold">{label}</td>
      <td className="py-1 align-top">: {value ?? "-"}</td>
    </tr>
  );
}

function SummaryRow({
  label,
  value,
  bold = false,
  accent = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <tr className={accent ? "bg-accent/10" : bold ? "bg-zinc-50" : ""}>
      <td colSpan={2} className={`border border-foreground px-2 py-1.5 text-right ${bold ? "font-semibold" : ""}`}>
        {label}
      </td>
      <td className={`border border-foreground px-2 py-1.5 text-right tabular-nums ${bold ? "font-semibold" : ""}`}>
        {formatIDR(value)}
      </td>
    </tr>
  );
}

function Section({
  group,
}: {
  group: { code: string | null; name: string | null; items: ItemRow[]; subtotal: number };
}) {
  return (
    <>
      <tr className="bg-zinc-50">
        <td colSpan={6} className="border border-foreground px-2 py-1.5 font-semibold">
          {group.code ? `${group.code} — ` : ""}{group.name ?? "Tanpa WBS"}
        </td>
      </tr>
      {group.items.map((it, idx) => {
        const total = calcItemTotal(it);
        return (
          <tr key={it.id}>
            <td className="border border-foreground px-2 py-1 text-center">
              {idx + 1}
            </td>
            <td className="border border-foreground px-2 py-1">{it.name}</td>
            <td className="border border-foreground px-2 py-1 text-right tabular-nums">
              {Number(it.volume).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
            </td>
            <td className="border border-foreground px-2 py-1 text-center">{it.unit}</td>
            <td className="border border-foreground px-2 py-1 text-right tabular-nums">
              {formatIDR(it.unitPrice)}
            </td>
            <td className="border border-foreground px-2 py-1 text-right tabular-nums">
              {formatIDR(total)}
            </td>
          </tr>
        );
      })}
      <tr className="bg-zinc-50">
        <td colSpan={5} className="border border-foreground px-2 py-1 text-right font-semibold">
          Subtotal {group.code ?? "tanpa WBS"}
        </td>
        <td className="border border-foreground px-2 py-1 text-right font-semibold tabular-nums">
          {formatIDR(group.subtotal)}
        </td>
      </tr>
    </>
  );
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: BreakdownRow[];
}) {
  const total = rows.reduce((s, r) => s + r.totalBiaya, 0);
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-base font-semibold">{title}</h3>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-zinc-100">
            <th className="border border-foreground px-2 py-2 w-8">No</th>
            <th className="border border-foreground px-2 py-2 text-left">Nama</th>
            <th className="border border-foreground px-2 py-2 w-24 text-right">Total Kebutuhan</th>
            <th className="border border-foreground px-2 py-2 w-12">Sat</th>
            <th className="border border-foreground px-2 py-2 w-24 text-right">Harga Sat</th>
            <th className="border border-foreground px-2 py-2 w-28 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name + i}>
              <td className="border border-foreground px-2 py-1 text-center">{i + 1}</td>
              <td className="border border-foreground px-2 py-1">{r.name}</td>
              <td className="border border-foreground px-2 py-1 text-right tabular-nums">
                {r.totalKebutuhan.toLocaleString("id-ID", { maximumFractionDigits: 4 })}
              </td>
              <td className="border border-foreground px-2 py-1 text-center">{r.unit}</td>
              <td className="border border-foreground px-2 py-1 text-right tabular-nums">
                {r.hargaSatuan ? formatIDR(r.hargaSatuan) : "-"}
              </td>
              <td className="border border-foreground px-2 py-1 text-right tabular-nums">
                {r.totalBiaya ? formatIDR(r.totalBiaya) : "-"}
              </td>
            </tr>
          ))}
          <tr className="bg-zinc-50">
            <td colSpan={5} className="border border-foreground px-2 py-1.5 text-right font-semibold">
              Subtotal {title}
            </td>
            <td className="border border-foreground px-2 py-1.5 text-right font-semibold tabular-nums">
              {formatIDR(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PrintStyles() {
  return (
    <style>{`
      @page {
        size: A4 portrait;
        margin: 1.5cm 1.2cm;
      }
      @media print {
        .no-print { display: none !important; }
        .print-main { padding: 0 !important; }
        .page-break-before { page-break-before: always; }
        .page-break-after { page-break-after: always; }
        body { background: white; color: black; }
        .bg-zinc-50, .bg-zinc-100 { background-color: #f4f4f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .bg-accent\\/10 { background-color: #fff3e0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      .print-toolbar { background: var(--muted); border-bottom: 1px solid var(--border); }
    `}</style>
  );
}
