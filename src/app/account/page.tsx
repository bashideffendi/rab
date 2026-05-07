import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "./form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-8">
          <Link
            href="/projects"
            className="text-sm font-medium text-muted-foreground hover:text-accent"
          >
            ← Workspace
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
            Pengaturan Akun
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Kelola password dan informasi akun.
          </p>
        </header>

        {/* Account info */}
        <section className="mb-8 rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Email Login
          </p>
          <p className="font-mono text-sm font-medium">{user.email}</p>
        </section>

        {/* Change password */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <header className="mb-4">
            <h2 className="text-base font-bold tracking-tight">
              Ganti Password
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Setelah ganti password, kamu akan logout otomatis dan harus
              login ulang dengan password baru.
            </p>
          </header>
          <ChangePasswordForm />
        </section>
      </section>
    </AppShell>
  );
}
