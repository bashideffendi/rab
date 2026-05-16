"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { UnitInput } from "@/components/ui/unit-input";
import { VolumeCalculator } from "@/components/ui/volume-calculator";
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
    calculatorType: string | null;
    calculatorInputs: Record<string, number> | null;
  };
}) {
  const router = useRouter();
  const action = updateProjectItem.bind(null, itemId, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const [unit, setUnit] = useState(initial.unit);
  const [volume, setVolume] = useState(initial.volume);
  const [calcMode, setCalcMode] = useState<string>(
    initial.calculatorType ?? "manual",
  );

  useEffect(() => {
    if (!pending && !state.error && !state.fieldErrors && state !== initialState) {
      router.push(`/projects/${projectId}`);
    }
  }, [pending, state, projectId, router]);

  // Sync unit "LS" ↔ calculator "lumsum" (sama kayak item-add-form).
  useEffect(() => {
    if (unit === "LS" && calcMode !== "lumsum") {
      setCalcMode("lumsum");
      setVolume("1.0000");
    } else if (unit !== "LS" && calcMode === "lumsum") {
      setCalcMode("manual");
    }
  }, [unit, calcMode]);

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

      {/* Volume Calculator — sama logic kayak item-add-form */}
      <div>
        {state.fieldErrors?.volume && (
          <p className="mb-1.5 text-xs font-medium text-danger">
            {state.fieldErrors.volume}
          </p>
        )}
        <VolumeCalculator
          defaultVolume={initial.volume}
          defaultInputs={initial.calculatorInputs}
          mode={calcMode}
          onModeChange={setCalcMode}
          onChange={(s) => {
            setVolume(s.volume);
            // Sync unit kalau calculator emit outputUnit (mis. switch ke
            // lumsum → "LS"). Hanya kalau current unit beda.
            if (s.outputUnit && s.outputUnit !== unit) {
              setUnit(s.outputUnit);
            }
          }}
        />
      </div>

      {/* Hidden field — supaya volume tetep ke-submit walau VolumeCalculator
          render hidden inputnya sendiri (manual mode). Sebenarnya VC udah
          submit volume via name="volume", jadi ini gak diperlukan. Tapi
          kita expose `volume` state untuk debug/preview di future. */}

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
