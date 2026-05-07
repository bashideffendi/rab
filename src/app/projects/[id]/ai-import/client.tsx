"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { applyAiExtraction } from "@/app/projects/ai-actions";

const STORAGE_PREFIX = "rabin:ai-extraction:";

type AhspMatch = {
  ahspId: string;
  ahspCode: string;
  ahspName: string;
  unit: string;
  score: number;
};

type ExtractedItem = {
  name: string;
  unit: string;
  estimatedVolume: number;
  confidence: "high" | "medium" | "low";
  notes?: string;
  ahspMatches: AhspMatch[];
};

type ExtractedWbs = {
  code: string;
  name: string;
  items: ExtractedItem[];
};

type ExtractResponse = {
  projectSummary: string;
  estimatedFloorAreaM2?: number;
  totalHeightM?: number;
  wbs: ExtractedWbs[];
};

// Per-item state untuk preview UI
type ItemState = {
  approved: boolean;
  volume: string;
  ahspId: string; // "" = custom, else ahsp id
};

const CONFIDENCE_LABELS = {
  high: { label: "Tinggi", color: "text-success border-success/40 bg-success/5" },
  medium: { label: "Sedang", color: "text-warning border-warning/40 bg-warning/5" },
  low: { label: "Rendah", color: "text-danger border-danger/40 bg-danger/5" },
};

export function AIImportClient({ projectId }: { projectId: string }) {
  const [phase, setPhase] = useState<"upload" | "loading" | "preview">(
    "upload",
  );
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractResponse | null>(null);
  const [itemStates, setItemStates] = useState<Map<string, ItemState>>(
    new Map(),
  );
  const [pendingApply, startApply] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const storageKey = `${STORAGE_PREFIX}${projectId}`;

  // Restore from localStorage on mount — biar gak ke-cost ulang kalau refresh
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as {
        extracted: ExtractResponse;
        itemStates: Array<[string, ItemState]>;
        savedAt: number;
      };
      // Skip kalau >24 jam (data stale)
      if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(storageKey);
        return;
      }
      setExtracted(parsed.extracted);
      setItemStates(new Map(parsed.itemStates));
      setPhase("preview");
    } catch {
      // ignore parse errors
    }
  }, [storageKey]);

  // Persist extracted + itemStates to localStorage tiap kali change
  useEffect(() => {
    if (!extracted) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          extracted,
          itemStates: Array.from(itemStates.entries()),
          savedAt: Date.now(),
        }),
      );
    } catch {
      // localStorage might be full, ignore
    }
  }, [extracted, itemStates, storageKey]);

  function itemKey(wbsCode: string, itemIdx: number): string {
    return `${wbsCode}::${itemIdx}`;
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file PDF dulu.");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("File harus PDF.");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError("File maksimal 30 MB.");
      return;
    }

    setPhase("loading");
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(`/api/projects/${projectId}/ai-extract`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data: ExtractResponse = await res.json();
      setExtracted(data);

      // Initialize item states — semua approved by default kecuali confidence low
      const states = new Map<string, ItemState>();
      for (const w of data.wbs) {
        for (let i = 0; i < w.items.length; i++) {
          const it = w.items[i];
          states.set(itemKey(w.code, i), {
            approved: it.confidence !== "low" && it.estimatedVolume > 0,
            volume: it.estimatedVolume.toString(),
            ahspId:
              it.ahspMatches[0] && it.ahspMatches[0].score > 0.4
                ? it.ahspMatches[0].ahspId
                : "",
          });
        }
      }
      setItemStates(states);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal upload.");
      setPhase("upload");
    }
  }

  function updateItemState(key: string, patch: Partial<ItemState>) {
    setItemStates((prev) => {
      const next = new Map(prev);
      const current = next.get(key) ?? {
        approved: false,
        volume: "0",
        ahspId: "",
      };
      next.set(key, { ...current, ...patch });
      return next;
    });
  }

  function handleApply() {
    if (!extracted) return;
    // Build payload dari approved items
    const wbsPayload = extracted.wbs
      .map((w) => {
        const items = w.items
          .map((it, idx) => {
            const state = itemStates.get(itemKey(w.code, idx));
            if (!state || !state.approved) return null;
            const vol = Number(state.volume);
            if (!Number.isFinite(vol) || vol <= 0) return null;
            return {
              name: it.name,
              unit: it.unit,
              volume: vol,
              ahspId: state.ahspId || undefined,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        if (items.length === 0) return null;
        return { code: w.code, name: w.name, items };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (wbsPayload.length === 0) {
      setError("Pilih minimal satu item untuk di-tambah.");
      return;
    }

    const fd = new FormData();
    fd.append("projectId", projectId);
    fd.append("payload", JSON.stringify({ wbs: wbsPayload }));

    startApply(() => {
      // Clear localStorage on apply success (next render is redirect anyway)
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      applyAiExtraction(fd);
    });
  }

  // ─── UPLOAD PHASE ────────────────────────────────────────────────────────
  if (phase === "upload") {
    return (
      <form
        onSubmit={handleUpload}
        className="rounded-md border-2 border-dashed border-border bg-card p-8 shadow-sm"
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 text-4xl">📄</div>
          <h2 className="mb-1 text-lg font-semibold">Upload Gambar Kerja PDF</h2>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            Format: PDF, max 30 MB. Bisa multi-page (denah, tampak, potongan,
            struktur). AI butuh ~30-60 detik untuk analisa.
          </p>
          <Input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="mb-4 max-w-sm cursor-pointer"
          />
          {error && (
            <div className="mb-4 rounded border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
          <Button type="submit" variant="primary" size="md">
            Analisa dengan AI →
          </Button>
        </div>
      </form>
    );
  }

  // ─── LOADING PHASE ───────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="rounded-md border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-3 text-4xl">⏳</div>
        <h2 className="mb-1 text-lg font-semibold">Sedang dianalisa…</h2>
        <p className="text-sm text-muted-foreground">
          Claude AI lagi baca gambar kerja-mu. Biasanya 30-90 detik tergantung
          jumlah halaman. Jangan refresh ya.
        </p>
        <div className="mx-auto mt-6 h-1 w-64 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-pulse bg-accent" />
        </div>
      </div>
    );
  }

  // ─── PREVIEW PHASE ───────────────────────────────────────────────────────
  if (!extracted) return null;

  const totalApproved = Array.from(itemStates.values()).filter(
    (s) => s.approved,
  ).length;
  const totalItems = Array.from(itemStates.values()).length;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-accent/30 bg-accent-soft p-4">
        <p className="mb-1 text-sm font-semibold text-accent">Ringkasan</p>
        <p className="text-sm text-foreground">{extracted.projectSummary}</p>
        <p className="mt-2 text-xs italic text-muted-foreground">
          ℹ Mode <strong>merge</strong>: items hasil AI akan <strong>
          ditambah</strong> ke project (gak menghapus item yang sudah ada).
          WBS dengan kode sama di-reuse.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {extracted.estimatedFloorAreaM2 != null && (
            <span>
              Luas estimasi: <strong>{extracted.estimatedFloorAreaM2} m²</strong>
            </span>
          )}
          {extracted.totalHeightM != null && (
            <span>
              Tinggi: <strong>{extracted.totalHeightM} m</strong>
            </span>
          )}
          <span>
            WBS: <strong>{extracted.wbs.length}</strong>
          </span>
          <span>
            Total items: <strong>{totalItems}</strong>
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {extracted.wbs.map((w) => (
        <section
          key={w.code}
          className="rounded-md border border-border bg-card shadow-sm"
        >
          <header className="border-b border-border px-4 py-3">
            <p className="font-mono text-xs text-muted-foreground">
              WBS {w.code}
            </p>
            <h3 className="text-base font-semibold">{w.name}</h3>
          </header>
          {w.items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground italic">
              (kategori header — sub-WBS punya item-nya)
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {w.items.map((it, idx) => {
                const key = itemKey(w.code, idx);
                const state = itemStates.get(key);
                if (!state) return null;
                const conf = CONFIDENCE_LABELS[it.confidence];
                return (
                  <li key={key} className="p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={state.approved}
                        onChange={(e) =>
                          updateItemState(key, { approved: e.target.checked })
                        }
                        className="mt-1.5 h-4 w-4 cursor-pointer accent-accent"
                      />
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-baseline gap-2">
                          <p className="font-medium">{it.name}</p>
                          <span
                            className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${conf.color}`}
                          >
                            Confidence {conf.label}
                          </span>
                        </div>
                        {it.notes && (
                          <p className="mb-2 text-xs italic text-muted-foreground">
                            {it.notes}
                          </p>
                        )}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">
                              Volume ({it.unit})
                            </label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={state.volume}
                              onChange={(e) =>
                                updateItemState(key, { volume: e.target.value })
                              }
                              className="font-mono text-right"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              Match AHSP
                            </label>
                            <Select
                              value={state.ahspId}
                              onChange={(e) =>
                                updateItemState(key, {
                                  ahspId: e.target.value,
                                })
                              }
                            >
                              <option value="">
                                — Custom (gak pakai AHSP) —
                              </option>
                              {it.ahspMatches.map((m) => (
                                <option key={m.ahspId} value={m.ahspId}>
                                  [{(m.score * 100).toFixed(0)}%] {m.ahspCode}{" "}
                                  — {m.ahspName.slice(0, 60)}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      <footer className="sticky bottom-0 -mx-6 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            <strong>{totalApproved}</strong> / {totalItems} items akan
            ditambah ke project.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                if (
                  !confirm(
                    "Buang hasil ekstraksi ini? (Bakal hilang dari cache, harus generate ulang dengan biaya AI)",
                  )
                )
                  return;
                try {
                  localStorage.removeItem(storageKey);
                } catch {}
                setPhase("upload");
                setExtracted(null);
                setError(null);
              }}
            >
              Batal &amp; Buang
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleApply}
              disabled={pendingApply || totalApproved === 0}
            >
              {pendingApply ? "Menambahkan…" : `Tambah ${totalApproved} Item ke Project`}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
