"use client";

import { useRef, useTransition } from "react";
import { deleteProjectItem } from "../item-actions";

export function ItemDeleteButton({
  id,
  projectId,
  name,
}: {
  id: string;
  projectId: string;
  name: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const ok = confirm(`Hapus item "${name}"?`);
    if (!ok) return;
    startTransition(() => formRef.current?.requestSubmit());
  }

  return (
    <form ref={formRef} action={deleteProjectItem}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="projectId" value={projectId} />
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded border border-transparent px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
        aria-label={`Hapus ${name}`}
      >
        {pending ? "…" : "×"}
      </button>
    </form>
  );
}
