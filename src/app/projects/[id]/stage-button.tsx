"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StageCalculatorModal } from "@/components/ui/stage-calculator-modal";

type WbsOption = { id: string; code: string; name: string };

export function StageButton({
  projectId,
  wbsOptions,
}: {
  projectId: string;
  wbsOptions: WbsOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function handleSuccess(created: number, warnings?: string[]) {
    let msg = `✓ ${created} item berhasil ditambah ke project`;
    if (warnings && warnings.length > 0) {
      msg += ` (${warnings.length} warning — beberapa material belum ada harga)`;
    }
    setToast(msg);
    router.refresh();
    setTimeout(() => setToast(null), 5000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/5 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-accent/10"
      >
        <span aria-hidden="true">📐</span>
        Tambah Tahap (Multi-Item)
      </button>

      <StageCalculatorModal
        open={open}
        projectId={projectId}
        wbsOptions={wbsOptions}
        onClose={() => setOpen(false)}
        onSuccess={handleSuccess}
      />

      {/* Simple toast notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-success/40 bg-background px-4 py-3 text-sm font-medium text-success shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
