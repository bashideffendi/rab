"use client";

import { useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/app/projects/actions";

export function DeleteProjectButton({
  id,
  projectName,
}: {
  id: string;
  projectName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const ok = confirm(
      `Hapus project "${projectName}"? Semua WBS & item RAB ikut terhapus permanen.`,
    );
    if (!ok) return;
    startTransition(() => formRef.current?.requestSubmit());
  }

  return (
    <form ref={formRef} action={deleteProject}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={handleClick}
        disabled={pending}
      >
        {pending ? "Menghapus…" : "Hapus"}
      </Button>
    </form>
  );
}
