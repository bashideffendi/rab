"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { AlamatPicker } from "@/components/ui/alamat-picker";
import { createProject, type CreateProjectFormState } from "../actions";
import { titleCaseOnBlur } from "@/lib/text-format";
import { PROJECT_TYPES } from "@/lib/project-types";
import { PROGRESS_PERIODS } from "@/lib/period";

type RegionOption = {
  id: string;
  code: string;
  name: string;
  ikk: string | null;
};

const initialState: CreateProjectFormState = {};

export function NewProjectForm({
  regionOptions,
}: {
  regionOptions: RegionOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createProject,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field
        label="Nama Project"
        htmlFor="name"
        required
        error={state.fieldErrors?.name}
        hint="Identifikasi singkat proyek. Contoh: Renovasi Rumah Jl. Mawar."
      >
        <Input
          id="name"
          name="name"
          autoFocus
          maxLength={200}
          placeholder="Mis. Renovasi Rumah Jl. Mawar atau Bangun Ruko 2 Lantai"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
          onBlur={titleCaseOnBlur}
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Jenis Project"
          htmlFor="projectType"
          required
          error={state.fieldErrors?.projectType}
          hint="Tipe bangunan atau pekerjaan konstruksi."
        >
          <Select
            id="projectType"
            name="projectType"
            defaultValue=""
            required
            aria-invalid={state.fieldErrors?.projectType ? true : undefined}
          >
            <option value="" disabled>
              — pilih jenis —
            </option>
            {PROJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Lokasi (Provinsi)"
          htmlFor="regionId"
          required
          error={state.fieldErrors?.regionId}
          hint="Indeks Kemahalan Konstruksi (IKK) menyesuaikan harga material."
        >
          <Select
            id="regionId"
            name="regionId"
            defaultValue=""
            required
            aria-invalid={state.fieldErrors?.regionId ? true : undefined}
          >
            <option value="" disabled>
              — pilih provinsi —
            </option>
            {regionOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.ikk ? ` · IKK ${r.ikk}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Luas Tanah (m²)"
          htmlFor="luasTanah"
          error={state.fieldErrors?.luasTanah}
          hint="Opsional. Untuk proyek dengan tanah."
        >
          <Input
            id="luasTanah"
            name="luasTanah"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="Mis. 120"
            className="font-mono text-right"
          />
        </Field>
        <Field
          label="Luas Bangunan (m²)"
          htmlFor="luasBangunan"
          error={state.fieldErrors?.luasBangunan}
          hint="Opsional. Total luas lantai bangunan."
        >
          <Input
            id="luasBangunan"
            name="luasBangunan"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="Mis. 80"
            className="font-mono text-right"
          />
        </Field>
      </div>

      <Field
        label="Klien / Pemilik Proyek"
        htmlFor="opd"
        required
        error={state.fieldErrors?.opd}
        hint="Untuk siapa RAB ini dibuat. Kalau proyek pribadi, isi nama kamu sendiri."
      >
        <Input
          id="opd"
          name="opd"
          placeholder="Mis. Bapak Andi, atau PT Maju Bersama"
          maxLength={200}
          onBlur={titleCaseOnBlur}
          required
          aria-invalid={state.fieldErrors?.opd ? true : undefined}
        />
      </Field>

      <Field
        label="Penanggung Jawab"
        htmlFor="ownerName"
        required
        error={state.fieldErrors?.ownerName}
        hint="Nama penyusun RAB atau PIC proyek."
      >
        <Input
          id="ownerName"
          name="ownerName"
          placeholder="Nama lengkap"
          maxLength={200}
          onBlur={titleCaseOnBlur}
          required
          aria-invalid={state.fieldErrors?.ownerName ? true : undefined}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Tahun Proyek"
          htmlFor="tahun"
          required
          error={state.fieldErrors?.tahun}
          hint="Tahun pelaksanaan."
        >
          <Input
            id="tahun"
            name="tahun"
            type="number"
            inputMode="numeric"
            placeholder="2026"
            min={1990}
            max={2100}
            defaultValue={new Date().getFullYear()}
            required
            aria-invalid={state.fieldErrors?.tahun ? true : undefined}
          />
        </Field>
        <Field
          label="Alamat Lengkap"
          htmlFor="alamat"
          required
          error={state.fieldErrors?.alamat}
          hint="Cari nama jalan/kelurahan di peta atau ketik manual."
        >
          <AlamatPicker id="alamat" required />
        </Field>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Konfigurasi Perhitungan
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="PPN (%)" htmlFor="ppnPercent" hint="Default 11%.">
            <Input
              id="ppnPercent"
              name="ppnPercent"
              type="number"
              inputMode="decimal"
              defaultValue="11"
              step="0.01"
              min="0"
              max="100"
            />
          </Field>
          <Field
            label="Overhead (%)"
            htmlFor="overheadPercent"
            hint="Margin profit/risiko."
          >
            <Input
              id="overheadPercent"
              name="overheadPercent"
              type="number"
              inputMode="decimal"
              defaultValue="0"
              step="0.01"
              min="0"
              max="100"
            />
          </Field>
          <Field
            label="Dibulatkan ke (Rp)"
            htmlFor="dibulatkanKe"
            hint="Pembulatan total."
          >
            <Input
              id="dibulatkanKe"
              name="dibulatkanKe"
              type="number"
              inputMode="numeric"
              defaultValue="1000"
              step="100"
              min="0"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field
            label="Periode Progress"
            htmlFor="progressPeriod"
            hint="Unit waktu untuk Schedule + Progress Tracking. Pilih sesuai durasi project."
          >
            <Select
              id="progressPeriod"
              name="progressPeriod"
              defaultValue="weekly"
            >
              {PROGRESS_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} — {p.hint}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <Field
        label="Catatan"
        htmlFor="notes"
        hint="Opsional. Tujuan singkat, scope khusus, atau hal penting lainnya."
      >
        <Textarea id="notes" name="notes" rows={3} maxLength={2000} />
      </Field>

      {state.error && (
        <div className="rounded border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          <span className="text-danger">*</span> Wajib diisi
        </p>
        <div className="flex items-center gap-3">
          <Link href="/projects">
            <Button type="button" variant="ghost" size="md">
              Batal
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={pending}
          >
            {pending ? "Menyimpan…" : "Buat Project"}
          </Button>
        </div>
      </div>
    </form>
  );
}
