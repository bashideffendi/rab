"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { UnitInput } from "@/components/ui/unit-input";
import { Field } from "@/components/ui/field";
import {
  updateProjectItem,
  type UpdateItemFormState,
} from "../../../../item-actions";

type WbsOption = { id: string; code: string; name: string };

const initialState: UpdateItemFormState = {};

export function EditItemForm({
  itemId,
  projectId,
  wbsOptions,
  initial,
}: {
  itemId: string;
  projectId: string;
  wbsOptions: WbsOption[];
  initial: {
    wbsItemId: string | null;
    name: string;
    unit: string;
    volume: string;
    unitPrice: string;
  };
}) {
  const router = useRouter();
  const action = updateProjectItem.bind(null, itemId, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [unit, setUnit] = useState(initial.unit);

  useEffect(() => {
    if (!pending && !state.error && !state.fieldErrors && state !== initialState) {
      router.push(`/projects/${projectId}`);
    }
  }, [pending, state, projectId, router]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="WBS" htmlFor="wbsItemId">
        <Select
          id="wbsItemId"
          name="wbsItemId"
          defaultValue={initial.wbsItemId ?? ""}
        >
          <option value="">— (tanpa WBS)</option>
          {wbsOptions.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Nama pekerjaan"
        htmlFor="name"
        required
        error={state.fieldErrors?.name}
      >
        <Input
          id="name"
          name="name"
          autoFocus
          defaultValue={initial.name}
          maxLength={200}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field
          label="Volume"
          htmlFor="volume"
          required
          error={state.fieldErrors?.volume}
        >
          <Input
            id="volume"
            name="volume"
            inputMode="decimal"
            defaultValue={initial.volume}
            className="font-mono text-right"
          />
        </Field>
        <Field
          label="Satuan"
          htmlFor="unit"
          required
          error={state.fieldErrors?.unit}
        >
          <UnitInput
            id="unit"
            name="unit"
            value={unit}
            onChange={setUnit}
            maxLength={20}
            className="font-mono"
          />
        </Field>
        <Field
          label="Harga Satuan (Rp)"
          htmlFor="unitPrice"
          required
          error={state.fieldErrors?.unitPrice}
        >
          <Input
            id="unitPrice"
            name="unitPrice"
            inputMode="decimal"
            defaultValue={initial.unitPrice}
            className="font-mono text-right"
          />
        </Field>
      </div>

      {state.error && (
        <div className="rounded border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-3">
        <Link href={`/projects/${projectId}`}>
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
