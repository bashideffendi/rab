import Link from "next/link";
import { SignupForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

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
            Daftar Gratis
          </h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Cukup email dan password. Tidak perlu kartu kredit, bisa langsung
            mulai bikin RAB.
          </p>
          <SignupForm />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link
              href={
                next
                  ? `/login?next=${encodeURIComponent(next)}`
                  : "/login"
              }
              className="font-medium text-accent hover:underline"
            >
              Masuk di sini
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
