"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { UnitInput } from "@/components/ui/unit-input";
import { Field } from "@/components/ui/field";
import { AhspPicker } from "@/components/ui/ahsp-picker";
import { VolumeCalculator } from "@/components/ui/volume-calculator";
import { AhspBreakdown } from "@/components/ui/ahsp-breakdown";
import {
  createProjectItem,
  type CreateItemFormState,
} from "../item-actions";
import { cn } from "@/lib/utils";

const initialState: CreateItemFormState = {};

type WbsOption = { id: string; code: string; name: string };

type Mode = "ahsp" | "custom";

export function ItemAddForm({
  projectId,
  wbsOptions,
  regionId = null,
}: {
  projectId: string;
  wbsOptions: WbsOption[];
  regionId?: string | null;
}) {
  const action = createProjectItem.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const ahspHasData = true; // search-based, always available

  // Controlled state — biar value gak ke-reset saat Server Action error
  const [mode, setMode] = useState<Mode>(ahspHasData ? "ahsp" : "custom");
  const [wbsItemId, setWbsItemId] = useState("");
  const [ahspItemId, setAhspItemId] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [volume, setVolume] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [calcMode, setCalcMode] = useState("manual");

  // Sync unit "LS" ↔ calculator mode "lumsum". User boleh pilih LS via
  // datalist satuan tanpa harus buka calculator — kalkulator auto-switch.
  // Reverse juga: kalau user ganti unit dari LS ke lain, calculator reset
  // ke manual.
  useEffect(() => {
    if (unit === "LS" && calcMode !== "lumsum") {
      setCalcMode("lumsum");
      setVolume("1.0000");
    } else if (unit !== "LS" && calcMode === "lumsum") {
      setCalcMode("manual");
    }
  }, [unit, calcMode]);

  // Sync from state.values kalau action balik dengan error
  useEffect(() => {
    if (state.values) {
      if (state.values.mode === "ahsp" || state.values.mode === "custom") {
        setMode(state.values.mode);
      }
      setWbsItemId(state.values.wbsItemId);
      setAhspItemId(state.values.ahspItemId);
      setName(state.values.name);
      setUnit(state.values.unit);
      setVolume(state.values.volume);
      setUnitPrice(state.values.unitPrice);
    }
  }, [state.values]);

  // Reset semua kalau action SUCCESS (no error, no fieldErrors, no values)
  useEffect(() => {
    if (
      !pending &&
      !state.error &&
      !state.fieldErrors &&
      !state.values
    ) {
      setWbsItemId("");
      setAhspItemId("");
      setName("");
      setUnit("");
      setVolume("");
      setUnitPrice("");
      setCalcMode("manual");
      nameRef.current?.focus();
    }
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-md border border-border bg-muted/40 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          + Tambah Item Pekerjaan
        </p>
        {ahspHasData && <ModeToggle mode={mode} onChange={setMode} />}
      </div>

      <input type="hidden" name="mode" value={mode} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-2">
          <Field label="WBS" htmlFor="item-wbs">
            <Select
              id="item-wbs"
              name="wbsItemId"
              value={wbsItemId}
              onChange={(e) => setWbsItemId(e.target.value)}
            >
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
          <div className="md:col-span-10">
            <Field
              label="AHSP"
              htmlFor="item-ahsp"
              error={state.fieldErrors?.ahspItemId}
              hint="Cari berdasarkan nama atau kode. Nama, satuan, dan harga di-snapshot saat disimpan."
            >
              <AhspPicker
                id="item-ahsp"
                name="ahspItemId"
                value={ahspItemId}
                onChange={(newId) => setAhspItemId(newId)}
              />
            </Field>
          </div>
        ) : (
          <>
            <div className="md:col-span-5">
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field
                label="Sat"
                htmlFor="item-unit"
                error={state.fieldErrors?.unit}
              >
                <UnitInput
                  id="item-unit"
                  name="unit"
                  placeholder="m³"
                  maxLength={20}
                  className="font-mono"
                  value={unit}
                  onChange={setUnit}
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
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}
      </div>

      {/* Volume Calculator — full width row */}
      <div className="mt-3">
        {state.fieldErrors?.volume && (
          <p className="mb-1.5 text-xs font-medium text-danger">
            {state.fieldErrors.volume}
          </p>
        )}
        <VolumeCalculator
          defaultVolume={volume}
          mode={calcMode}
          onModeChange={setCalcMode}
          onChange={(s) => {
            setVolume(s.volume);
            // Custom mode + calculator output unit → auto-fill satuan.
            // Bantu user yang lupa isi "LS" sendiri pas pilih Lumsum.
            if (mode === "custom" && s.outputUnit) {
              setUnit(s.outputUnit);
            }
          }}
        />
      </div>

      {/* AHSP Breakdown — tampil otomatis kalau AHSP + volume udah ada */}
      {mode === "ahsp" && ahspItemId && Number(volume) > 0 && (
        <div className="mt-4">
          <AhspBreakdown
            ahspId={ahspItemId}
            volume={Number(volume)}
            regionId={regionId}
          />
        </div>
      )}

      {state.warning && (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
          {state.warning}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        {state.error ? (
          <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-1.5 text-xs text-danger">
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
    <div className="flex overflow-hidden rounded-md border border-border text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange("ahsp")}
        className={cn(
          "px-3 py-1 transition-colors",
          mode === "ahsp"
            ? "bg-accent text-white"
            : "bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        AHSP
      </button>
      <button
        type="button"
        onClick={() => onChange("custom")}
        className={cn(
          "border-l border-border px-3 py-1 transition-colors",
          mode === "custom"
            ? "bg-accent text-white"
            : "bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        Custom
      </button>
    </div>
  );
}
