import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { AIImportClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AIImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const projectRows = await db
    .select({ id: schema.projects.id, name: schema.projects.name })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)))
    .limit(1);
  const project = projectRows[0];
  if (!project) notFound();

  return (
    <AppShell>
      <section className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm font-medium text-muted-foreground hover:text-accent"
        >
          ← {project.name}
        </Link>

        <header className="mt-2 mb-6">
          <p className="text-sm font-semibold text-accent">
            AI Generate dari Gambar Kerja
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Upload PDF, AI bikin draft RAB
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload gambar kerja PDF (denah, tampak, struktur). AI analisa, output
            draft WBS + item RAB dengan estimasi volume. Kamu review & approve
            per row sebelum masuk ke project.
          </p>
        </header>

        <AIImportClient projectId={project.id} />

        <section className="mt-12 rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">⚠ Disclaimer</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              AI ngestimasi volume <strong>kasar</strong> berdasarkan dimensi
              yang terbaca. Confidence rendah = pasti perlu manual verify.
            </li>
            <li>
              Untuk RAB final/tender, engineer perlu review semua item dan
              recalculate dengan dokumen detailed.
            </li>
            <li>
              Match AHSP otomatis pakai keyword similarity — gak selalu akurat,
              user pilih AHSP yang benar.
            </li>
            <li>
              File PDF dikirim ke Claude API (Anthropic), gak disimpan di
              server kita. Sekali analisa, dibuang setelah response.
            </li>
          </ul>
        </section>
      </section>
    </AppShell>
  );
}
