"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

export async function login(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = (formData.get("email") ?? "").toString().trim();
  const password = (formData.get("password") ?? "").toString();
  const next = (formData.get("next") ?? "/projects").toString();

  const fieldErrors: NonNullable<LoginFormState["fieldErrors"]> = {};
  if (!email) fieldErrors.email = "Email wajib diisi.";
  if (!password) fieldErrors.password = "Password wajib diisi.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(next.startsWith("/") ? next : "/projects");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
