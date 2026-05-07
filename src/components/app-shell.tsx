import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">
              <span className="text-accent">RAB</span>in
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-muted-foreground sm:gap-6">
            {user ? (
              <>
                <Link
                  href="/projects"
                  className="font-medium hover:text-foreground"
                >
                  Workspace
                </Link>
                <Link
                  href="/account"
                  className="font-medium hover:text-foreground"
                  title={user.email ?? undefined}
                >
                  Akun
                </Link>
                <span
                  className="hidden font-mono text-xs sm:inline"
                  title={user.email ?? undefined}
                >
                  {user.email?.split("@")[0]}
                </span>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="font-medium hover:text-foreground"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-accent/90"
                >
                  Daftar Gratis
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-muted/20 px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 text-xs text-muted-foreground md:flex-row md:items-center">
          <p className="font-mono">rabin.masbash.id</p>
          <p>&copy; 2026 Bashid Effendi</p>
        </div>
      </footer>
    </div>
  );
}
