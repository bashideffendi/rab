"use client";

import { useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/app/projects/actions";

export function DeleteProjectButton({
  id,
  projectName,
  compact = false,
}: {
  id: string;
  projectName: string;
  compact?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const ok = confirm(
      `Hapus project "${projectName}"?\n\nSemua WBS, item RAB, dan jadwal akan terhapus permanen dan tidak bisa dipulihkan.`,
    );
    if (!ok) return;
    startTransition(() => formRef.current?.requestSubmit());
  }

  return (
    <form ref={formRef} action={deleteProject}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="button"
        variant={compact ? "ghost" : "danger"}
        size="sm"
        onClick={handleClick}
        disabled={pending}
        className={
          compact
            ? "px-2.5 text-danger hover:bg-danger/10 hover:text-danger"
            : undefined
        }
        title="Hapus project secara permanen"
      >
        {pending ? "Menghapus…" : "Hapus"}
      </Button>
    </form>
  );
}
