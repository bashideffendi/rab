"use client";

import { useTransition } from "react";
import {
  duplicateProject,
  toggleArchiveProject,
} from "@/app/projects/actions";
import { Button } from "@/components/ui/button";

export function DuplicateButton({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
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
      <Button
        type="submit"
        variant={compact ? "ghost" : "secondary"}
        size="sm"
        disabled={pending}
        className={compact ? "px-2.5" : undefined}
        title="Duplikasi project beserta WBS dan item RAB"
      >
        {pending ? "Menggandakan…" : "Duplikat"}
      </Button>
    </form>
  );
}

export function ArchiveButton({
  id,
  isArchived,
  compact = false,
}: {
  id: string;
  isArchived: boolean;
  compact?: boolean;
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
      <Button
        type="submit"
        variant={compact ? "ghost" : "secondary"}
        size="sm"
        disabled={pending}
        className={compact ? "px-2.5" : undefined}
        title={
          isArchived
            ? "Pindahkan kembali ke daftar aktif"
            : "Arsipkan project (data tetap tersimpan)"
        }
      >
        {pending ? "…" : isArchived ? "Aktifkan" : "Arsipkan"}
      </Button>
    </form>
  );
}
