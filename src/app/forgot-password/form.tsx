"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  requestPasswordReset,
  type ForgotPasswordFormState,
} from "./actions";

const initialState: ForgotPasswordFormState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );
  const [email, setEmail] = useState("");

  if (state.success) {
    return (
      <div className="rounded-md border border-success/40 bg-success/5 p-4 text-sm">
        <p className="font-semibold text-success">✓ Permintaan terkirim</p>
        <p className="mt-1 text-muted-foreground">
          Kalau email{" "}
          <span className="font-mono font-medium text-foreground">
            {email}
          </span>{" "}
          terdaftar, link reset password akan dikirim. Cek inbox (atau folder
          spam) — link berlaku 1 jam.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Email"
        htmlFor="email"
        required
        error={state.fieldErrors?.email}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="kamu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>

      {state.error && (
        <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Mengirim…" : "Kirim Link Reset"}
      </Button>
    </form>
  );
}
