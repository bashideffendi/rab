import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-mono text-sm text-accent">▲</span>
            <span className="font-semibold tracking-tight">RABin</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/projects" className="hover:text-foreground">
              Projects
            </Link>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-muted-foreground">
          <p className="font-mono">rabin.masbash.id</p>
          <p>&copy; 2026 Bashid Effendi</p>
        </div>
      </footer>
    </div>
  );
}
