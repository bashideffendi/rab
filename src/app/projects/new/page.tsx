import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { NewProjectForm } from "./form";
import { loadProvinsiOptions } from "@/lib/queries/regions";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const regionOptions = await loadProvinsiOptions().catch(() => []);

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-8">
          <Link
            href="/projects"
            className="text-sm font-medium text-muted-foreground hover:text-accent"
          >
            ← Projects
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Project Baru
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Lengkapi data proyek di bawah. Lokasi wajib dipilih agar harga
            material menyesuaikan IKK provinsi setempat.
          </p>
        </header>
        <NewProjectForm regionOptions={regionOptions} />
      </section>
    </AppShell>
  );
}
