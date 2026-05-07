"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  createProjectItem,
  type CreateItemFormState,
} from "../item-actions";
import { cn } from "@/lib/utils";

const initialState: CreateItemFormState = {};

type WbsOption = { id: string; code: string; name: string };
type AhspOption = {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string;
};

type Mode = "ahsp" | "custom";

export function ItemAddForm({
  projectId,
  wbsOptions,
  ahspOptions,
}: {
  projectId: string;
  wbsOptions: WbsOption[];
  ahspOptions: AhspOption[];
}) {
  const action = createProjectItem.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const ahspHasData = ahspOptions.length > 0;
  const [mode, setMode] = useState<Mode>(ahspHasData ? "ahsp" : "custom");

  useEffect(() => {
    if (!pending && !state.error && !state.fieldErrors) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded border border-border bg-muted/30 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          + Tambah item pekerjaan
        </p>
        {ahspHasData && (
          <ModeToggle mode={mode} onChange={setMode} />
        )}
      </div>

      <input type="hidden" name="mode" value={mode} />

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

        {mode === "ahsp" ? (
          <div className="md:col-span-7">
            <Field
              label="AHSP"
              htmlFor="item-ahsp"
              error={state.fieldErrors?.ahspItemId}
              hint="Nama, satuan, harga di-snapshot dari komponen × harga material saat disimpan."
            >
              <Select id="item-ahsp" name="ahspItemId" defaultValue="">
                <option value="">— pilih AHSP —</option>
                {ahspOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name} ({a.unit})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <>
            <div className="md:col-span-4">
              <Field
                label="Nama pekerjaan"
                htmlFor="item-name"
                error={state.fieldErrors?.name}
              >
                <Input
                  id="item-name"
                  name="name"
                  placeholder="Galian tanah pondasi"
                  maxLength={200}
                />
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field
                label="Harga Sat (Rp)"
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
          </>
        )}

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

        {mode === "custom" && (
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
        )}
      </div>

      {state.warning && (
        <div className="mt-3 rounded border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
          {state.warning}
        </div>
      )}

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

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded border border-border font-mono text-[10px] uppercase tracking-wider">
      <button
        type="button"
        onClick={() => onChange("ahsp")}
        className={cn(
          "px-2.5 py-1 transition-colors",
          mode === "ahsp"
            ? "bg-accent text-black"
            : "bg-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        AHSP
      </button>
      <button
        type="button"
        onClick={() => onChange("custom")}
        className={cn(
          "border-l border-border px-2.5 py-1 transition-colors",
          mode === "custom"
            ? "bg-accent text-black"
            : "bg-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        Custom
      </button>
    </div>
  );
}
