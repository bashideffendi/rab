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
            <span className="font-mono text-sm text-accent">▲</span>
            <span className="font-semibold tracking-tight">RABin</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">
            Bikin Akun
          </h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Gratis. Akun ini buat akses RAB-mu di mana aja.
          </p>
          <SignupForm />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Udah punya akun?{" "}
            <Link
              href={
                next
                  ? `/login?next=${encodeURIComponent(next)}`
                  : "/login"
              }
              className="text-accent hover:underline"
            >
              Masuk
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
