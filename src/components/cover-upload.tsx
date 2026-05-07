"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CoverUpload({
  projectId,
  currentUrl,
}: {
  projectId: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/cover`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload gagal.");
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload gagal.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!confirm("Hapus foto sampul?")) return;
    setError(null);
    setRemoving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cover`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hapus gagal.");
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hapus gagal.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading || removing}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : currentUrl ? "Ganti Foto" : "Upload Foto"}
        </Button>
        {currentUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading || removing}
            onClick={handleRemove}
          >
            {removing ? "Menghapus…" : "Hapus Foto"}
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground">
          JPG/PNG/WEBP · maks 5 MB
        </span>
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>
      )}
    </div>
  );
}
