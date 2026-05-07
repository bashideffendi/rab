"use client";

import { useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { TrashIcon } from "@/components/ui/icons";
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

  const button = (
    <Button
      type="button"
      variant={compact ? "ghost" : "danger"}
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className={
        compact
          ? "h-8 w-8 px-0 text-muted-foreground hover:bg-danger/10 hover:text-danger"
          : undefined
      }
      aria-label="Hapus project"
    >
      {compact ? (
        <TrashIcon size={16} />
      ) : pending ? (
        "Menghapus…"
      ) : (
        "Hapus"
      )}
    </Button>
  );

  const form = (
    <form ref={formRef} action={deleteProject}>
      <input type="hidden" name="id" value={id} />
      {button}
    </form>
  );

  if (compact) {
    return (
      <Tooltip content={pending ? "Menghapus…" : "Hapus project"}>
        {form}
      </Tooltip>
    );
  }
  return form;
}
