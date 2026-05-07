"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ResetPasswordFormState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"newPassword" | "confirmPassword", string>
  >;
};

const MIN_PASSWORD_LEN = 8;

export async function setNewPassword(
  _prev: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const newPassword = (formData.get("newPassword") ?? "").toString();
  const confirmPassword = (formData.get("confirmPassword") ?? "").toString();

  const fieldErrors: NonNullable<ResetPasswordFormState["fieldErrors"]> = {};
  if (!newPassword) fieldErrors.newPassword = "Password baru wajib diisi.";
  else if (newPassword.length < MIN_PASSWORD_LEN)
    fieldErrors.newPassword = `Minimal ${MIN_PASSWORD_LEN} karakter.`;
  if (newPassword !== confirmPassword)
    fieldErrors.confirmPassword = "Konfirmasi tidak cocok.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Sesi reset tidak valid atau sudah expired. Minta link reset baru.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { error: `Gagal update password: ${error.message}` };
  }

  // Success — sign out semua session lama, force login dengan password baru
  await supabase.auth.signOut();
  redirect("/login?reset=success");
}
