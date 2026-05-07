"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { signup, type SignupFormState } from "./actions";

const initialState: SignupFormState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state.message) {
    return (
      <div className="rounded border border-accent/40 bg-accent/5 p-4 text-sm text-foreground">
        <p className="mb-2 text-sm font-semibold text-accent">
          Cek Email
        </p>
        <p>{state.message}</p>
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
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        hint="Minimal 8 karakter."
        error={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
      </Field>

      {state.error && (
        <div className="rounded border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Mendaftar…" : "Bikin Akun"}
      </Button>
    </form>
  );
}
