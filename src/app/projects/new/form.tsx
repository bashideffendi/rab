"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { createProject, type CreateProjectFormState } from "../actions";

const initialState: CreateProjectFormState = {};

export function NewProjectForm() {
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
          placeholder="Contoh: Pembangunan Jembatan Sungai X"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
      </Field>

      <Field
        label="OPD / Instansi"
        htmlFor="opd"
        hint="Optional. Contoh: Dinas PUPR Kota Batam."
      >
        <Input
          id="opd"
          name="opd"
          placeholder="Dinas PUPR Kota Batam"
          maxLength={200}
        />
      </Field>

      <Field
        label="PPK / Owner"
        htmlFor="ownerName"
        hint="Optional. Nama PPK atau penanggung jawab."
      >
        <Input
          id="ownerName"
          name="ownerName"
          placeholder="Nama lengkap PPK"
          maxLength={200}
        />
      </Field>

      <Field
        label="Catatan"
        htmlFor="notes"
        hint="Optional. Tujuan, lokasi singkat, sumber dana."
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
