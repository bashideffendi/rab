"use client";

import type { CSSProperties, Ref } from "react";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateWbsItem,
  type UpdateWbsFormState,
} from "../wbs-actions";
import { titleCaseOnBlur } from "@/lib/text-format";
import { WbsDeleteButton } from "./wbs-delete-button";

const initialState: UpdateWbsFormState = {};

export type WbsSortableProps = {
  setNodeRef: Ref<HTMLLIElement>;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  style: CSSProperties;
};

type Props = {
  id: string;
  code: string;
  name: string;
  level: number;
  projectId: string;
  notes: string | null;
  sortable?: WbsSortableProps;
};

export function WbsRow({
  id,
  code,
  name,
  level,
  projectId,
  notes,
  sortable,
}: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <WbsRowEdit
        id={id}
        code={code}
        name={name}
        level={level}
        projectId={projectId}
        notes={notes}
        onDone={() => setEditing(false)}
      />
    );
  }

  const liStyle: CSSProperties = {
    paddingLeft: `${1 + level * 1.5}rem`,
    ...(sortable?.style ?? {}),
  };

  return (
    <li
      ref={sortable?.setNodeRef}
      style={liStyle}
      className="group border-b border-border bg-background last:border-b-0 hover:bg-muted/30"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {sortable && (
          <button
            type="button"
            aria-label={`Drag ${code}`}
            className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="5" cy="3" r="1.2" />
              <circle cx="9" cy="3" r="1.2" />
              <circle cx="5" cy="7" r="1.2" />
              <circle cx="9" cy="7" r="1.2" />
              <circle cx="5" cy="11" r="1.2" />
              <circle cx="9" cy="11" r="1.2" />
            </svg>
          </button>
        )}
        <span className="shrink-0 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-xs text-muted-foreground tabular-nums">
          {code}
        </span>
        <span className="flex-1 text-sm">
          {name}
          {notes && (
            <span
              className="ml-1.5 cursor-help text-xs text-accent"
              title={notes}
              aria-label={`Catatan: ${notes}`}
            >
              📝
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded px-2 py-0.5 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-accent group-hover:opacity-100"
        >
          Edit
        </button>
        <WbsDeleteButton
          id={id}
          projectId={projectId}
          code={code}
          name={name}
        />
      </div>
      {notes && (
        <div className="px-4 pb-2 text-[11px] italic text-muted-foreground line-clamp-2">
          {notes}
        </div>
      )}
    </li>
  );
}

function WbsRowEdit({
  id,
  code,
  name,
  level,
  projectId,
  notes,
  onDone,
}: Omit<Props, "sortable"> & { onDone: () => void }) {
  const action = updateWbsItem.bind(null, id, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  useEffect(() => {
    codeRef.current?.focus();
    codeRef.current?.select();
  }, []);

  return (
    <li
      className="border-b border-border bg-accent/5 px-4 py-3 last:border-b-0"
      style={{ paddingLeft: `${1 + level * 1.5}rem` }}
    >
      <form action={formAction} className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="w-28 shrink-0">
            <Input
              ref={codeRef}
              name="code"
              defaultValue={code}
              maxLength={50}
              autoComplete="off"
              className="font-mono"
            />
            {state.fieldErrors?.code && (
              <p className="mt-1 text-xs text-danger">
                {state.fieldErrors.code}
              </p>
            )}
          </div>
          <div className="flex-1">
            <Input
              name="name"
              defaultValue={name}
              maxLength={200}
              onBlur={titleCaseOnBlur}
            />
            {state.fieldErrors?.name && (
              <p className="mt-1 text-xs text-danger">
                {state.fieldErrors.name}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={pending}
            >
              {pending ? "…" : "Simpan"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDone}
              disabled={pending}
            >
              Batal
            </Button>
          </div>
        </div>
        <textarea
          name="notes"
          defaultValue={notes ?? ""}
          rows={2}
          maxLength={1000}
          placeholder="Catatan (opsional) — mis. asumsi struktur, referensi gambar"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </form>
      {state.error && (
        <p className="mt-2 rounded border border-danger/40 bg-danger/5 px-3 py-1.5 text-xs text-danger">
          {state.error}
        </p>
      )}
    </li>
  );
}
