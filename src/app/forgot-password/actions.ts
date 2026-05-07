"use server";

import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordFormState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Partial<Record<"email", string>>;
};

export async function requestPasswordReset(
  _prev: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const email = (formData.get("email") ?? "").toString().trim();

  if (!email) {
    return { fieldErrors: { email: "Email wajib diisi." } };
  }
  if (!email.includes("@")) {
    return { fieldErrors: { email: "Format email tidak valid." } };
  }

  const supabase = await createClient();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  if (error) {
    // Supabase by default tidak mengirim error spesifik (security:
    // hindari email enumeration). Tetap tampilkan success ke user.
    console.error("[reset-password] error:", error.message);
  }

  // Always return success — biar attacker gak bisa enumerate email valid
  return { success: true };
}
