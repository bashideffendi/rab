"use client";

import { useRef, useTransition } from "react";
import { deleteWbsItem } from "../wbs-actions";

export function WbsDeleteButton({
  id,
  projectId,
  code,
  name,
}: {
  id: string;
  projectId: string;
  code: string;
  name: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const ok = confirm(
      `Hapus WBS "${code} ${name}"? Sub-item & RAB items di bawahnya ikut terhapus.`,
    );
    if (!ok) return;
    startTransition(() => formRef.current?.requestSubmit());
  }

  return (
    <form ref={formRef} action={deleteWbsItem}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="projectId" value={projectId} />
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="shrink-0 rounded border border-transparent px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
        aria-label={`Hapus ${code}`}
      >
        {pending ? "…" : "×"}
      </button>
    </form>
  );
}
