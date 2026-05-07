import Link from "next/link";
import { ResetPasswordForm } from "./form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">
              <span className="text-accent">RAB</span>in
            </span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            Reset Password
          </h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Masukkan password baru untuk akun-mu. Setelah di-set, kamu akan
            di-arahkan ke halaman login.
          </p>
          <ResetPasswordForm />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Inget password lama?{" "}
            <Link
              href="/login"
              className="font-medium text-accent hover:underline"
            >
              Login di sini
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
