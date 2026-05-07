"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { AlamatPicker } from "@/components/ui/alamat-picker";
import { updateProject, type UpdateProjectFormState } from "../../actions";
import type { schema } from "@/db";
import { titleCaseOnBlur } from "@/lib/text-format";

type ProjectRow = typeof schema.projects.$inferSelect;

type RegionOption = {
  id: string;
  code: string;
  name: string;
  ikk: string | null;
};

const initialState: UpdateProjectFormState = {};

export function EditProjectForm({
  project,
  regionOptions,
}: {
  project: ProjectRow;
  regionOptions: RegionOption[];
}) {
  const action = updateProject.bind(null, project.id);
  const [state, formAction, pending] = useActionState(action, initialState);

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
          defaultValue={project.name}
          maxLength={200}
          onBlur={titleCaseOnBlur}
          required
        />
      </Field>

      <Field
        label="Status"
        htmlFor="status"
        required
        error={state.fieldErrors?.status}
      >
        <Select
          id="status"
          name="status"
          defaultValue={project.status}
          required
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
      </Field>

      <Field
        label="Lokasi (Provinsi)"
        htmlFor="regionId"
        required
        error={state.fieldErrors?.regionId}
        hint="Indeks Kemahalan Konstruksi (IKK) per provinsi mempengaruhi harga material."
      >
        <Select
          id="regionId"
          name="regionId"
          defaultValue={project.regionId ?? ""}
          required
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
          defaultValue={project.opd ?? ""}
          maxLength={200}
          onBlur={titleCaseOnBlur}
          required
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
          defaultValue={project.ownerName ?? ""}
          maxLength={200}
          onBlur={titleCaseOnBlur}
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Tahun Proyek"
          htmlFor="tahun"
          required
          error={state.fieldErrors?.tahun}
        >
          <Input
            id="tahun"
            name="tahun"
            type="number"
            inputMode="numeric"
            defaultValue={project.tahun ?? ""}
            min={1990}
            max={2100}
            required
          />
        </Field>
        <Field
          label="Alamat Lengkap"
          htmlFor="alamat"
          required
          error={state.fieldErrors?.alamat}
          hint="Cari di peta atau ketik manual."
        >
          <AlamatPicker
            id="alamat"
            defaultValue={project.alamat ?? ""}
            defaultLat={project.lat ?? ""}
            defaultLng={project.lng ?? ""}
            required
          />
        </Field>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Konfigurasi Perhitungan
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="PPN (%)" htmlFor="ppnPercent">
            <Input
              id="ppnPercent"
              name="ppnPercent"
              type="number"
              inputMode="decimal"
              defaultValue={project.ppnPercent}
              step="0.01"
              min="0"
              max="100"
            />
          </Field>
          <Field label="Overhead (%)" htmlFor="overheadPercent">
            <Input
              id="overheadPercent"
              name="overheadPercent"
              type="number"
              inputMode="decimal"
              defaultValue={project.overheadPercent}
              step="0.01"
              min="0"
              max="100"
            />
          </Field>
          <Field label="Dibulatkan ke (Rp)" htmlFor="dibulatkanKe">
            <Input
              id="dibulatkanKe"
              name="dibulatkanKe"
              type="number"
              inputMode="numeric"
              defaultValue={project.dibulatkanKe}
              step="100"
              min="0"
            />
          </Field>
        </div>
      </div>

      <Field label="Catatan" htmlFor="notes">
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={project.notes ?? ""}
          maxLength={2000}
        />
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
          <Link href={`/projects/${project.id}`}>
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
            {pending ? "Menyimpan…" : "Simpan Perubahan"}
          </Button>
        </div>
      </div>
    </form>
  );
}
