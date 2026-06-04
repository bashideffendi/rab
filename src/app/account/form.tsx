"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  changePassword,
  logoutAfterPasswordChange,
  type ChangePasswordFormState,
} from "./actions";

const initialState: ChangePasswordFormState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialState,
  );

  // Auto-logout setelah password berubah, redirect ke login
  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => {
        logoutAfterPasswordChange();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [state.success]);

  if (state.success) {
    return (
      <div className="rounded-md border border-success/40 bg-success/5 p-4 text-sm">
        <p className="font-semibold text-success-text">
          ✓ Password berhasil diubah
        </p>
        <p className="mt-1 text-muted-foreground">
          Logout otomatis dalam 1 detik. Silakan login ulang dengan password
          baru.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Password Lama"
        htmlFor="currentPassword"
        required
        error={state.fieldErrors?.currentPassword}
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

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

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={pending}
        >
          {pending ? "Memproses…" : "Ganti Password"}
        </Button>
      </div>
    </form>
  );
}
