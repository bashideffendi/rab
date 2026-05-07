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
          placeholder="Mis. Renovasi Rumah Jl. Mawar atau Bangun Ruko 2 Lantai"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
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
