"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { fcHintFor } from "@/lib/ahsp-search";

const isIllustrative = (sourceDoc?: string | null) =>
  /illustrative|ilustratif/i.test(sourceDoc ?? "");

/** Tag edisi AHSP: hijau utk versi berlaku, amber utk edisi lama (superseded). */
function VersionTag({
  name,
  current,
}: {
  name?: string | null;
  current?: boolean | null;
}) {
  if (!name) return null;
  const cls = current === false ? "text-amber-600" : "text-emerald-600";
  const tag = current === false ? " (lama)" : current ? " ✓" : "";
  return (
    <span className={cls}>
      {" · "}
      {name}
      {tag}
    </span>
  );
}

export type AhspOption = {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string;
  sourceDoc?: string | null;
  versionName?: string | null;
  versionCurrent?: boolean | null;
};

/**
 * Searchable combobox untuk AHSP catalog (~2,669 items). Replace
 * native <select> yang gak scalable. Server-side search via
 * /api/ahsp/search dengan debounced query (300ms).
 */
export function AhspPicker({
  name,
  value,
  onChange,
  initialOption,
  placeholder = "Cari AHSP (mis. \"beton K-225\" atau kode \"1.1.1.10\")…",
  required,
  id,
}: {
  name: string;
  value: string;
  onChange: (newId: string, option: AhspOption | null) => void;
  initialOption?: AhspOption | null;
  placeholder?: string;
  required?: boolean;
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AhspOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AhspOption | null>(
    initialOption ?? null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/ahsp/search?q=${encodeURIComponent(query)}&limit=30`,
        );
        if (!res.ok) throw new Error("Search failed");
        const data: AhspOption[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, open]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function pick(option: AhspOption) {
    setSelected(option);
    onChange(option.id, option);
    setOpen(false);
    setQuery("");
  }

  function clearSelection() {
    setSelected(null);
    onChange("", null);
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input untuk form submit */}
      <input type="hidden" name={name} value={value} required={required} />

      {/* Selected display OR search input */}
      {selected && !open ? (
        <div
          className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-sm"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <div className="flex-1 cursor-pointer">
            <p className="text-sm">
              <span className="font-mono text-xs text-muted-foreground">
                {selected.code}
              </span>{" "}
              <span>{selected.name}</span>
              {isIllustrative(selected.sourceDoc) && (
                <span className="ml-1.5 rounded border border-danger/40 bg-danger/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-danger">
                  Ilustratif
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {selected.unit}
              <VersionTag
                name={selected.versionName ?? selected.sourceDoc}
                current={selected.versionCurrent}
              />
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearSelection();
            }}
            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-danger"
          >
            ✕ Ganti
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      )}

      {/* Dropdown results */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded-md border border-border bg-card shadow-lg">
          {(() => {
            const hint = fcHintFor(query);
            return hint ? (
              <div className="border-b border-border bg-accent/5 px-3 py-1.5 text-[10px] text-muted-foreground">
                Mutu <span className="font-mono">K-{hint.k}</span> ≈{" "}
                <span className="font-mono">f&apos;c {hint.fc} MPa</span> —
                dicocokkan ke notasi AHSP.
              </div>
            ) : null;
          })()}
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Cari…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              {query
                ? `Tidak ada AHSP cocok untuk "${query}". Coba kata kunci lain.`
                : "Ketik untuk cari AHSP…"}
            </div>
          )}
          {!loading && results.length > 0 && (
            <ul className="divide-y divide-border">
              {results.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => pick(opt)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted",
                      selected?.id === opt.id && "bg-accent/10",
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-accent">
                        {opt.code}
                      </span>
                      <span className="text-sm">{opt.name}</span>
                      {isIllustrative(opt.sourceDoc) && (
                        <span className="rounded border border-danger/40 bg-danger/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-danger">
                          Ilustratif
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Sat: {opt.unit}
                      <VersionTag
                        name={opt.versionName ?? opt.sourceDoc}
                        current={opt.versionCurrent}
                      />
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && results.length >= 30 && (
            <div className="border-t border-border px-3 py-1.5 text-[10px] italic text-muted-foreground">
              Menampilkan 30 hasil teratas. Persempit kata kunci untuk
              hasil lebih spesifik.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
