"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  createProjectItem,
  type CreateItemFormState,
} from "../item-actions";

const initialState: CreateItemFormState = {};

type WbsOption = { id: string; code: string; name: string };

export function ItemAddForm({
  projectId,
  wbsOptions,
}: {
  projectId: string;
  wbsOptions: WbsOption[];
}) {
  const action = createProjectItem.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pending && !state.error && !state.fieldErrors) {
      formRef.current?.reset();
      nameRef.current?.focus();
    }
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded border border-border bg-muted/30 p-4"
    >
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        + Tambah item pekerjaan
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-2">
          <Field label="WBS" htmlFor="item-wbs">
            <Select id="item-wbs" name="wbsItemId" defaultValue="">
              <option value="">—</option>
              {wbsOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} {w.name.slice(0, 30)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="md:col-span-4">
          <Field
            label="Nama pekerjaan"
            htmlFor="item-name"
            error={state.fieldErrors?.name}
          >
            <Input
              ref={nameRef}
              id="item-name"
              name="name"
              placeholder="Galian tanah pondasi"
              maxLength={200}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field
            label="Volume"
            htmlFor="item-volume"
            error={state.fieldErrors?.volume}
          >
            <Input
              id="item-volume"
              name="volume"
              inputMode="decimal"
              placeholder="100"
              className="font-mono text-right"
            />
          </Field>
        </div>
        <div className="md:col-span-1">
          <Field
            label="Sat"
            htmlFor="item-unit"
            error={state.fieldErrors?.unit}
          >
            <Input
              id="item-unit"
              name="unit"
              placeholder="m3"
              maxLength={20}
              className="font-mono"
            />
          </Field>
        </div>
        <div className="md:col-span-3">
          <Field
            label="Harga Satuan (Rp)"
            htmlFor="item-unitprice"
            error={state.fieldErrors?.unitPrice}
          >
            <Input
              id="item-unitprice"
              name="unitPrice"
              inputMode="decimal"
              placeholder="350000"
              className="font-mono text-right"
            />
          </Field>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        {state.error ? (
          <div className="rounded border border-danger/40 bg-danger/5 px-3 py-1.5 text-xs text-danger">
            {state.error}
          </div>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Menyimpan…" : "Tambah Item"}
        </Button>
      </div>
    </form>
  );
}
