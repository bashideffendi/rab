"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateWbsItem,
  type UpdateWbsFormState,
} from "../wbs-actions";
import { titleCaseOnBlur } from "@/lib/text-format";
import { WbsDeleteButton } from "./wbs-delete-button";

const initialState: UpdateWbsFormState = {};

type Props = {
  id: string;
  code: string;
  name: string;
  level: number;
  projectId: string;
};

export function WbsRow({ id, code, name, level, projectId }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <WbsRowEdit
        id={id}
        code={code}
        name={name}
        level={level}
        projectId={projectId}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <li
      className="group flex items-center gap-4 border-b border-border bg-background px-4 py-3 last:border-b-0 hover:bg-muted/30"
      style={{ paddingLeft: `${1 + level * 1.5}rem` }}
    >
      <span className="shrink-0 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-xs text-muted-foreground tabular-nums">
        {code}
      </span>
      <span className="flex-1 text-sm">{name}</span>
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
    </li>
  );
}

function WbsRowEdit({
  id,
  code,
  name,
  level,
  projectId,
  onDone,
}: Props & { onDone: () => void }) {
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
      <form action={formAction} className="flex items-start gap-2">
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
      </form>
      {state.error && (
        <p className="mt-2 rounded border border-danger/40 bg-danger/5 px-3 py-1.5 text-xs text-danger">
          {state.error}
        </p>
      )}
    </li>
  );
}
