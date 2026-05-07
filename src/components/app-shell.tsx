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
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-mono text-sm text-accent">▲</span>
            <span className="font-semibold tracking-tight">RABin</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            {user ? (
              <>
                <Link href="/projects" className="hover:text-foreground">
                  Projects
                </Link>
                <span
                  className="hidden text-sm text-muted-foreground sm:inline"
                  title={user.email ?? undefined}
                >
                  {user.email?.split("@")[0]}
                </span>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-foreground">
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-accent/90"
                >
                  Daftar
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-muted/30 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-muted-foreground">
          <p>rabin.masbash.id</p>
          <p>&copy; 2026 Bashid Effendi</p>
        </div>
      </footer>
    </div>
  );
}
