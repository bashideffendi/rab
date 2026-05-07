"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  createWbsItem,
  type CreateWbsFormState,
} from "../wbs-actions";

const initialState: CreateWbsFormState = {};

export function WbsAddForm({ projectId }: { projectId: string }) {
  const action = createWbsItem.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Reset form on success (no error and no fieldErrors)
  useEffect(() => {
    if (!pending && !state.error && !state.fieldErrors) {
      formRef.current?.reset();
      codeRef.current?.focus();
    }
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded border border-border bg-muted/30 p-4"
    >
      <p className="mb-3 text-sm font-medium text-muted-foreground">
        + Tambah item
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="sm:w-32">
          <Field label="Code" htmlFor="wbs-code" error={state.fieldErrors?.code}>
            <Input
              ref={codeRef}
              id="wbs-code"
              name="code"
              placeholder="1.1.2"
              maxLength={50}
              autoComplete="off"
              className="font-mono"
            />
          </Field>
        </div>
        <div className="flex-1">
          <Field
            label="Nama pekerjaan"
            htmlFor="wbs-name"
            error={state.fieldErrors?.name}
          >
            <Input
              id="wbs-name"
              name="name"
              placeholder="Contoh: Galian tanah pondasi"
              maxLength={200}
            />
          </Field>
        </div>
        <div className="sm:pt-[22px]">
          <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? "…" : "Tambah"}
          </Button>
        </div>
      </div>
      {state.error && (
        <div className="mt-3 rounded border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
          {state.error}
        </div>
      )}
    </form>
  );
}
