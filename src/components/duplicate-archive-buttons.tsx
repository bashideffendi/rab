"use client";

import { useTransition } from "react";
import {
  duplicateProject,
  toggleArchiveProject,
} from "@/app/projects/actions";
import { Button } from "@/components/ui/button";

export function DuplicateButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        start(() => {
          duplicateProject(fd);
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Menggandakan…" : "Duplikat"}
      </Button>
    </form>
  );
}

export function ArchiveButton({
  id,
  isArchived,
}: {
  id: string;
  isArchived: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        start(() => {
          toggleArchiveProject(fd);
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="archive"
        value={isArchived ? "false" : "true"}
      />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending
          ? "…"
          : isArchived
            ? "Aktifkan"
            : "Arsipkan"}
      </Button>
    </form>
  );
}
