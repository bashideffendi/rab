import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { NewProjectForm } from "./form";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  return (
    <AppShell>
      <section className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-8">
          <Link
            href="/projects"
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent"
          >
            ← Projects
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Project Baru
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuma butuh nama untuk mulai. Detail lain bisa diisi belakangan.
          </p>
        </header>
        <NewProjectForm />
      </section>
    </AppShell>
  );
}
