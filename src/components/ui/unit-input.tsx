"use client";

import { Input, type InputProps } from "./input";
import { STANDARD_UNITS, normalizeUnit } from "@/lib/units";

const DATALIST_ID = "rabin-standard-units";

/**
 * UnitInput — text input dengan datalist suggestion satuan standar +
 * auto-normalize di onBlur ("m3" → "m³", "ls" → "LS", dst).
 *
 * User tetep boleh ketik satuan unik (datalist cuma suggestion). Wajib
 * controlled — pass `value` & `onChange`. Kalau perlu submit via form,
 * kasih `name` ke Input prop seperti biasa.
 */
export function UnitInput({
  value,
  onChange,
  ...rest
}: Omit<InputProps, "list" | "onBlur" | "onChange" | "value"> & {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <>
      <Input
        list={DATALIST_ID}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const normalized = normalizeUnit(e.target.value);
          if (normalized !== e.target.value) onChange(normalized);
        }}
        {...rest}
      />
      <datalist id={DATALIST_ID}>
        {STANDARD_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </>
  );
}
