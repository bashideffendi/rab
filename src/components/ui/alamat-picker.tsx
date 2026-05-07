"use client";

import { useEffect, useRef, useState } from "react";
import { toTitleCaseId } from "@/lib/text-format";

type Place = {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
};

/**
 * Alamat picker dengan typeahead OpenStreetMap (Nominatim API).
 * Free, no API key. Rate limit 1 req/sec — debounced 600ms.
 *
 * Submit 3 fields: alamat (text), lat (numeric), lng (numeric).
 */
export function AlamatPicker({
  defaultValue = "",
  defaultLat = "",
  defaultLng = "",
  name = "alamat",
  latName = "lat",
  lngName = "lng",
  id,
  required,
  placeholder = "Cari nama jalan, kelurahan, atau landmark…",
}: {
  defaultValue?: string;
  defaultLat?: string;
  defaultLng?: string;
  name?: string;
  latName?: string;
  lngName?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [lat, setLat] = useState(defaultLat);
  const [lng, setLng] = useState(defaultLng);
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search via Nominatim
  useEffect(() => {
    if (!open || !value || value.trim().length < 4) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          value,
        )}&format=json&countrycodes=id&limit=5&addressdetails=1`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "id" },
        });
        if (!res.ok) throw new Error("Search failed");
        const data: Place[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [value, open]);

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

  function pick(place: Place) {
    setValue(place.display_name);
    setLat(place.lat);
    setLng(place.lon);
    setOpen(false);
  }

  function clearLocation() {
    setLat("");
    setLng("");
  }

  const hasLocation = !!(lat && lng);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        id={id}
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          // Kalau alamat dirubah manual, anggap lat/lng stale → clear
          if (lat || lng) clearLocation();
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          // Apply title case kalau gak ada koordinat (alamat manual)
          if (!hasLocation) {
            const formatted = toTitleCaseId(e.currentTarget.value);
            if (formatted !== e.currentTarget.value) {
              e.currentTarget.value = formatted;
              setValue(formatted);
            }
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        maxLength={300}
        autoComplete="off"
        required={required}
      />
      <input type="hidden" name={latName} value={lat} />
      <input type="hidden" name={lngName} value={lng} />

      {/* Dropdown hasil */}
      {open && (loading || results.length > 0 || value.trim().length >= 4) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-card shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Cari di OpenStreetMap…
            </div>
          )}
          {!loading && results.length === 0 && value.trim().length >= 4 && (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              Tidak ketemu di peta. Coba nama lain atau ketik manual aja.
            </div>
          )}
          {!loading && results.length > 0 && (
            <ul className="divide-y divide-border">
              {results.map((p) => (
                <li key={p.place_id}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span className="text-sm">{p.display_name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      📍 {Number(p.lat).toFixed(4)}, {Number(p.lon).toFixed(4)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border bg-muted/30 px-3 py-1.5 text-[10px] italic text-muted-foreground">
            Pakai data OpenStreetMap. Hasil mungkin gak persis — pilih yg
            paling deket atau ketik manual.
          </div>
        </div>
      )}

      {/* Status koordinat */}
      {hasLocation && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-accent">
            ✓ Lokasi tersimpan:{" "}
            <span className="font-mono">
              {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
            </span>
          </span>
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-accent"
          >
            Buka di Google Maps ↗
          </a>
        </div>
      )}
    </div>
  );
}
