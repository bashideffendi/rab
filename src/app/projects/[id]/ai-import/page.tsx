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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            AI Generate dari Gambar Kerja
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight">
            Upload PDF gambar kerja, AI susun draft RAB
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Unggah file PDF gambar kerja (denah, tampak, atau struktur). AI
            akan menganalisa dan menghasilkan draft WBS beserta item RAB dengan
            estimasi volume. Setiap baris dapat di-review dan disetujui sebelum
            masuk ke project.
          </p>
        </header>

        <AIImportClient projectId={project.id} />

        <section className="mt-12 rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p className="mb-2 font-semibold text-foreground">⚠ Disclaimer</p>
          <ul className="list-disc space-y-1.5 pl-4">
            <li>
              AI menghasilkan estimasi volume <strong>kasar</strong> berdasarkan
              dimensi yang terbaca. Confidence rendah perlu verifikasi manual
              wajib.
            </li>
            <li>
              Untuk RAB final atau tender, engineer wajib mereview seluruh item
              dan menghitung ulang dengan dokumen detail.
            </li>
            <li>
              Pencocokan AHSP otomatis menggunakan keyword similarity — tidak
              selalu akurat. Pengguna bertanggung jawab memilih AHSP yang
              tepat.
            </li>
            <li>
              File PDF dikirim ke Claude API (Anthropic) untuk dianalisa.
              Setelah respons diterima, file langsung dihapus — tidak disimpan
              di server.
            </li>
          </ul>
        </section>
      </section>
    </AppShell>
  );
}
