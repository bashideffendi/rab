"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { createProject, type CreateProjectFormState } from "../actions";

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
      >
        <Input
          id="name"
          name="name"
          autoFocus
          maxLength={200}
          placeholder="Mis. Renovasi Rumah Jl. Mawar atau Bangun Ruko 2 Lantai"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
      </Field>

      <Field
        label="Lokasi (Provinsi)"
        htmlFor="regionId"
        hint="Opsional. Bikin harga material ngikut daerah. Kosongin = harga nasional default."
      >
        <Select id="regionId" name="regionId" defaultValue="">
          <option value="">— pilih provinsi (opsional) —</option>
          {regionOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.ikk ? ` · IKK ${r.ikk}` : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Klien / Pemilik Proyek"
        htmlFor="opd"
        hint="Opsional. Buat siapa RAB ini? Kalau bikin sendiri, kosongin aja."
      >
        <Input
          id="opd"
          name="opd"
          placeholder="Mis. Bapak Andi, atau PT Maju Bersama"
          maxLength={200}
        />
      </Field>

      <Field
        label="Penanggung Jawab"
        htmlFor="ownerName"
        hint="Opsional. Nama yang nyusun atau PIC proyek."
      >
        <Input
          id="ownerName"
          name="ownerName"
          placeholder="Mis. nama kamu sendiri"
          maxLength={200}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tahun" htmlFor="tahun" hint="Opsional.">
          <Input
            id="tahun"
            name="tahun"
            type="number"
            inputMode="numeric"
            placeholder="2026"
            min={1990}
            max={2100}
          />
        </Field>
        <Field
          label="Alamat Lengkap"
          htmlFor="alamat"
          hint="Opsional."
        >
          <Input
            id="alamat"
            name="alamat"
            placeholder="Jl. / desa / kelurahan"
            maxLength={300}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          label="PPN (%)"
          htmlFor="ppnPercent"
          hint="Default 11."
        >
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
          hint="Margin profit/risiko. Default 0."
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
          hint="Default Rp 1.000."
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

      <Field
        label="Catatan"
        htmlFor="notes"
        hint="Opsional. Tujuan singkat, lokasi, atau hal penting lain."
      >
        <Textarea id="notes" name="notes" rows={3} maxLength={2000} />
      </Field>

      {state.error && (
        <div className="rounded border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-3">
        <Link href="/projects">
          <Button type="button" variant="ghost" size="md">
            Batal
          </Button>
        </Link>
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Menyimpan…" : "Buat Project"}
        </Button>
      </div>
    </form>
  );
}
