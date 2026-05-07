"use client";

import { useTransition } from "react";
import {
  duplicateProject,
  toggleArchiveProject,
} from "@/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CopyIcon,
} from "@/components/ui/icons";

export function DuplicateButton({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const button = (
    <Button
      type="submit"
      variant={compact ? "ghost" : "secondary"}
      size="sm"
      disabled={pending}
      className={compact ? "h-8 w-8 px-0" : undefined}
      aria-label="Duplikasi project"
    >
      {compact ? (
        <CopyIcon size={16} />
      ) : pending ? (
        "Menggandakan…"
      ) : (
        "Duplikat"
      )}
    </Button>
  );

  const form = (
    <form
      action={(fd) => {
        start(() => {
          duplicateProject(fd);
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      {button}
    </form>
  );

  if (compact) {
    return (
      <Tooltip content={pending ? "Menggandakan…" : "Duplikat project"}>
        {form}
      </Tooltip>
    );
  }
  return form;
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
  const label = isArchived ? "Aktifkan" : "Arsipkan";
  const tooltipText = isArchived
    ? "Pindahkan ke daftar aktif"
    : "Arsipkan project (data tetap tersimpan)";

  const button = (
    <Button
      type="submit"
      variant={compact ? "ghost" : "secondary"}
      size="sm"
      disabled={pending}
      className={compact ? "h-8 w-8 px-0" : undefined}
      aria-label={label}
    >
      {compact ? (
        isArchived ? (
          <ArchiveRestoreIcon size={16} />
        ) : (
          <ArchiveIcon size={16} />
        )
      ) : pending ? (
        "…"
      ) : (
        label
      )}
    </Button>
  );

  const form = (
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
      {button}
    </form>
  );

  if (compact) {
    return <Tooltip content={tooltipText}>{form}</Tooltip>;
  }
  return form;
}
