"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordFormState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Partial<
    Record<"currentPassword" | "newPassword" | "confirmPassword", string>
  >;
};

const MIN_PASSWORD_LEN = 8;

export async function changePassword(
  _prev: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const currentPassword = (formData.get("currentPassword") ?? "").toString();
  const newPassword = (formData.get("newPassword") ?? "").toString();
  const confirmPassword = (formData.get("confirmPassword") ?? "").toString();

  const fieldErrors: NonNullable<ChangePasswordFormState["fieldErrors"]> = {};
  if (!currentPassword)
    fieldErrors.currentPassword = "Password lama wajib diisi.";
  if (!newPassword) fieldErrors.newPassword = "Password baru wajib diisi.";
  else if (newPassword.length < MIN_PASSWORD_LEN)
    fieldErrors.newPassword = `Minimal ${MIN_PASSWORD_LEN} karakter.`;
  if (newPassword !== confirmPassword)
    fieldErrors.confirmPassword = "Konfirmasi tidak cocok.";
  if (newPassword === currentPassword && newPassword)
    fieldErrors.newPassword = "Password baru harus berbeda dari yang lama.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { error: "Sesi login tidak valid. Silakan login ulang." };
  }

  // Verify current password by re-authenticating
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInErr) {
    return { fieldErrors: { currentPassword: "Password lama salah." } };
  }

  // Update password
  const { error: updateErr } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateErr) {
    return { error: `Gagal update password: ${updateErr.message}` };
  }

  return { success: true };
}

/**
 * Logout dari semua sesi setelah password berubah.
 * Forces user untuk login ulang dengan password baru.
 */
export async function logoutAfterPasswordChange() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
