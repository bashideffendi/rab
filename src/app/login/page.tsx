import Link from "next/link";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { next, reset } = await searchParams;

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
            Selamat Datang
          </h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Masuk ke akun untuk mengakses workspace RAB kamu.
          </p>

          {reset === "success" && (
            <div className="mb-5 rounded-md border border-success/40 bg-success/5 px-3 py-2.5 text-sm">
              <p className="font-semibold text-success">
                ✓ Password berhasil direset
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Silakan login dengan password baru.
              </p>
            </div>
          )}

          <LoginForm next={next ?? "/projects"} />

          <div className="mt-4 text-center text-sm">
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-accent hover:underline"
            >
              Lupa password?
            </Link>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link
              href={
                next
                  ? `/signup?next=${encodeURIComponent(next)}`
                  : "/signup"
              }
              className="font-medium text-accent hover:underline"
            >
              Daftar gratis di sini
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
