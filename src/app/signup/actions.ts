"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignupFormState = {
  error?: string;
  message?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
  /** Preserve email on error. Password jangan di-preserve (security). */
  values?: { email: string };
};

export async function signup(
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const email = (formData.get("email") ?? "").toString().trim();
  const password = (formData.get("password") ?? "").toString();

  const fieldErrors: NonNullable<SignupFormState["fieldErrors"]> = {};
  if (!email) fieldErrors.email = "Email wajib diisi.";
  if (!email.includes("@")) fieldErrors.email = "Format email gak valid.";
  if (!password) fieldErrors.password = "Password wajib diisi.";
  else if (password.length < 8)
    fieldErrors.password = "Password minimal 8 karakter.";
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values: { email } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message, values: { email } };
  }

  if (data.user && !data.session) {
    return {
      message: `Cek email ${email} untuk konfirmasi akun, baru bisa login.`,
    };
  }

  redirect("/projects");
}
