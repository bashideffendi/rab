"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { updateProject, type UpdateProjectFormState } from "../../actions";
import type { schema } from "@/db";

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
        />
      </Field>

      <Field label="Status" htmlFor="status" error={state.fieldErrors?.status}>
        <Select id="status" name="status" defaultValue={project.status}>
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </Select>
      </Field>

      <Field
        label="Lokasi (Provinsi)"
        htmlFor="regionId"
        hint="Bikin harga material ngikut daerah. Kosongin = harga nasional."
      >
        <Select
          id="regionId"
          name="regionId"
          defaultValue={project.regionId ?? ""}
        >
          <option value="">— pilih provinsi —</option>
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
        hint="Buat siapa RAB ini? Kosongin aja kalau bikin sendiri."
      >
        <Input
          id="opd"
          name="opd"
          defaultValue={project.opd ?? ""}
          maxLength={200}
        />
      </Field>

      <Field
        label="Penanggung Jawab"
        htmlFor="ownerName"
        hint="Nama yang nyusun atau PIC proyek."
      >
        <Input
          id="ownerName"
          name="ownerName"
          defaultValue={project.ownerName ?? ""}
          maxLength={200}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tahun" htmlFor="tahun">
          <Input
            id="tahun"
            name="tahun"
            type="number"
            inputMode="numeric"
            defaultValue={project.tahun ?? ""}
            min={1990}
            max={2100}
          />
        </Field>
        <Field label="Alamat Lengkap" htmlFor="alamat">
          <Input
            id="alamat"
            name="alamat"
            defaultValue={project.alamat ?? ""}
            maxLength={300}
          />
        </Field>
      </div>

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

      <div className="mt-2 flex items-center justify-end gap-3">
        <Link href={`/projects/${project.id}`}>
          <Button type="button" variant="ghost" size="md">
            Batal
          </Button>
        </Link>
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  );
}
