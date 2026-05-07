"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { setNewPassword, type ResetPasswordFormState } from "./actions";

const initialState: ResetPasswordFormState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    setNewPassword,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Password Baru"
        htmlFor="newPassword"
        required
        error={state.fieldErrors?.newPassword}
        hint="Minimal 8 karakter."
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          autoFocus
          required
        />
      </Field>

      <Field
        label="Konfirmasi Password Baru"
        htmlFor="confirmPassword"
        required
        error={state.fieldErrors?.confirmPassword}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      {state.error && (
        <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Memproses…" : "Set Password Baru"}
      </Button>
    </form>
  );
}
