"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "./button";

const MapInner = dynamic(() => import("./map-picker-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-muted/20 text-sm text-muted-foreground">
      Memuat peta…
    </div>
  ),
});

const INDONESIA_CENTER = { lat: -2.5, lng: 117 };

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
};

export function MapPickerModal({
  open,
  initialLat,
  initialLng,
  initialAddress,
  onClose,
  onConfirm,
}: {
  open: boolean;
  initialLat?: string;
  initialLng?: string;
  initialAddress?: string;
  onClose: () => void;
  onConfirm: (lat: string, lng: string, address: string) => void;
}) {
  const hasInitialPin = !!(initialLat && initialLng);
  const startLat = hasInitialPin
    ? Number(initialLat)
    : INDONESIA_CENTER.lat;
  const startLng = hasInitialPin
    ? Number(initialLng)
    : INDONESIA_CENTER.lng;

  const [pin, setPin] = useState({ lat: startLat, lng: startLng });
  const [pinSet, setPinSet] = useState(hasInitialPin);
  const [address, setAddress] = useState(initialAddress ?? "");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);

  // Reset state pas modal dibuka
  useEffect(() => {
    if (open) {
      setPin({ lat: startLat, lng: startLng });
      setPinSet(hasInitialPin);
      setAddress(initialAddress ?? "");
      setSearchQ("");
      setSearchResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reverse geocode pas pin pindah
  useEffect(() => {
    if (!open || !pinSet) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setReverseLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${pin.lat}&lon=${pin.lng}&format=json&addressdetails=1`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "id" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.display_name) {
          setAddress(data.display_name);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setReverseLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pin.lat, pin.lng, open, pinSet]);

  // ESC tutup modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Search Nominatim
  useEffect(() => {
    if (!open || !searchQ || searchQ.trim().length < 4) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQ)}&format=json&countrycodes=id&limit=5`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "id" },
        });
        if (!res.ok) throw new Error();
        const data: SearchResult[] = await res.json();
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQ, open]);

  function handleClickMap(lat: number, lng: number) {
    setPin({ lat, lng });
    setPinSet(true);
  }

  function handleSelectResult(r: SearchResult) {
    setPin({ lat: Number(r.lat), lng: Number(r.lon) });
    setPinSet(true);
    setAddress(r.display_name);
    setSearchQ("");
    setSearchResults([]);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h3 className="text-base font-bold tracking-tight">
              Pilih Lokasi di Peta
            </h3>
            <p className="text-xs text-muted-foreground">
              Klik di peta untuk drop pin, atau cari nama lokasi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Tutup"
          >
            ✕
          </button>
        </header>

        {/* Search */}
        <div className="relative border-b border-border p-3">
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Cari nama jalan, kelurahan, atau landmark…"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {searchQ.trim().length >= 4 &&
            (searching || searchResults.length > 0) && (
              <div className="absolute left-3 right-3 top-full z-10 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-card shadow-lg">
                {searching && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Mencari…
                  </div>
                )}
                {!searching &&
                  searchResults.map((r) => (
                    <button
                      key={r.place_id}
                      type="button"
                      onClick={() => handleSelectResult(r)}
                      className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    >
                      {r.display_name}
                    </button>
                  ))}
              </div>
            )}
        </div>

        {/* Map */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <MapInner
            initialLat={startLat}
            initialLng={startLng}
            pinLat={pin.lat}
            pinLng={pin.lng}
            hasInitialPin={pinSet}
            onChange={handleClickMap}
          />
        </div>

        {/* Address preview */}
        <div className="border-t border-border bg-muted/30 px-5 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Alamat Terbaca
          </p>
          <p className="line-clamp-2 text-sm font-medium leading-snug">
            {pinSet
              ? address ||
                (reverseLoading
                  ? "Membaca alamat dari peta…"
                  : "Alamat tidak terbaca, ketik manual di form.")
              : "Klik di peta untuk memilih lokasi."}
          </p>
          {pinSet && (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              📍 {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </p>
          )}
        </div>

        {/* Actions */}
        <footer className="flex items-center justify-end gap-3 border-t border-border px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={!pinSet}
            onClick={() =>
              onConfirm(pin.lat.toFixed(7), pin.lng.toFixed(7), address)
            }
          >
            Pakai Lokasi Ini
          </Button>
        </footer>
      </div>
    </div>
  );
}
