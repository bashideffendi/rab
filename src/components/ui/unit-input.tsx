"use client";

import { useEffect, useRef, useState } from "react";
import { Input, type InputProps } from "./input";
import { STANDARD_UNITS, normalizeUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * UnitInput — combobox text input dengan list 19 satuan standar.
 * Klik input atau panah ▼ → dropdown muncul, klik lagi (atau klik luar) →
 * tutup. User boleh ketik satuan unik di luar list (dropdown auto-filter
 * pas user ngetik). onBlur normalize input ke canonical form
 * ("m3" → "m³", "ls" → "LS", dst).
 *
 * Datalist HTML5 gak dipake karena Chrome gak buka ulang dropdown setelah
 * exact match — UX-nya bingungin user. Custom dropdown lebih konsisten
 * cross-browser.
 */
export function UnitInput({
  value,
  onChange,
  className,
  ...rest
}: Omit<InputProps, "list" | "onBlur" | "onChange" | "value"> & {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close kalau klik di luar
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Filter: kalau value cocok persis sama 1 opsi, tetep tampilin SEMUA opsi
  // (biar user bisa ganti). Kalau value parsial/typing, filter by prefix.
  const query = value.trim().toLowerCase();
  const exactMatch = STANDARD_UNITS.some((u) => u.toLowerCase() === query);
  const filtered =
    !query || exactMatch
      ? STANDARD_UNITS
      : STANDARD_UNITS.filter((u) => u.toLowerCase().includes(query));

  function selectOption(opt: string) {
    onChange(opt);
    setOpen(false);
  }

  function handleBlur(raw: string) {
    const normalized = normalizeUnit(raw);
    if (normalized !== raw) onChange(normalized);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        {...rest}
        className={cn("pr-8", className)}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => handleBlur(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        autoComplete="off"
      />
      <button
        type="button"
        aria-label="Toggle daftar satuan"
        onClick={() => setOpen((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-md"
        >
          {filtered.map((opt) => {
            const isSelected = opt === value;
            return (
              <li
                key={opt}
                role="option"
                aria-selected={isSelected}
                // Pake onMouseDown (bukan onClick) supaya fire SEBELUM input
                // onBlur — kalau onClick, blur fire dulu & dropdown tertutup
                // sebelum click ke-register.
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(opt);
                }}
                className={cn(
                  "cursor-pointer px-3 py-1.5 font-mono text-sm hover:bg-muted",
                  isSelected && "bg-accent-soft text-accent",
                )}
              >
                {opt}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
