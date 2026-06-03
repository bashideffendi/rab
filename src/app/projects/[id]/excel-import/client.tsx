"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatIDR } from "@/lib/utils";
import {
  applyExcelImport,
  type ImportRow,
} from "@/app/projects/import-actions";

export function ExcelImportClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"upload" | "preview">("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [wbsOption, setWbsOption] = useState<"none" | "auto">("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/import-excel`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal parse file.");
        return;
      }
      if (!data.rows?.length) {
        setError("Tidak ada baris valid di file.");
        setWarnings(data.warnings ?? []);
        return;
      }
      setRows(data.rows);
      setWarnings(data.warnings ?? []);
      setPhase("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal upload.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  function commit() {
    setError(null);
    startTransition(async () => {
      const res = await applyExcelImport(projectId, rows, wbsOption);
      if (res?.error) setError(res.error);
      else router.push(`/projects/${projectId}`);
    });
  }

  const total = rows.reduce((s, r) => s + r.volume * r.unitPrice, 0);

  if (phase === "upload") {
    return (
      <div className="mt-6">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-6 py-12 text-center transition-colors hover:border-accent/50">
          <span className="text-3xl">📄</span>
          <span className="text-sm font-medium">
            {loading ? "Membaca file…" : "Pilih file .xlsx"}
          </span>
          <span className="text-xs text-muted-foreground">
            Maks 5 MB · kolom Nama, Satuan, Volume, Harga Satuan
          </span>
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            disabled={loading}
            onChange={handleFile}
          />
        </label>
        {error && (
          <p className="mt-3 text-sm text-danger">{error}</p>
        )}
        {warnings.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">
          {rows.length} baris siap diimpor
        </p>
        <button
          type="button"
          onClick={() => {
            setPhase("upload");
            setRows([]);
            setError(null);
          }}
          className="text-xs text-muted-foreground hover:text-accent"
        >
          ↻ Ganti file
        </button>
      </div>

      <div className="max-h-96 overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Uraian</th>
              <th className="px-3 py-2 text-center">Sat</th>
              <th className="px-3 py-2 text-right">Volume</th>
              <th className="px-3 py-2 text-right">Harga Sat</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className="px-3 py-1.5">{r.name}</td>
                <td className="px-3 py-1.5 text-center text-muted-foreground">
                  {r.unit}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {r.volume.toLocaleString("id-ID")}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {formatIDR(r.unitPrice)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {formatIDR(r.volume * r.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-muted/60 font-medium">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right">
                Total
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-accent">
                {formatIDR(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {warnings.length > 0 && (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {warnings.length} baris dilewati saat parsing
          </summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </details>
      )}

      <fieldset className="mt-4 text-sm">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Kelompok WBS
        </legend>
        <label className="mr-4 inline-flex items-center gap-1.5">
          <input
            type="radio"
            name="wbs"
            checked={wbsOption === "none"}
            onChange={() => setWbsOption("none")}
          />
          Tanpa WBS
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="radio"
            name="wbs"
            checked={wbsOption === "auto"}
            onChange={() => setWbsOption("auto")}
          />
          Buat WBS &quot;Import Excel&quot; otomatis
        </label>
      </fieldset>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={commit}
          disabled={pending}
          className="rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : `Tambah ${rows.length} Item →`}
        </button>
      </div>
    </div>
  );
}
