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
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl">
            Upload PDF gambar kerja, AI susun draft RAB
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Unggah PDF gambar kerja — AI akan baca denah, tampak, dan
            potongan, lalu menghasilkan draft WBS beserta estimasi volume per
            item.
          </p>
        </header>

        {/* Info card: model + cara kerja */}
        <section className="mb-6 overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 via-card to-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border bg-accent/10 px-5 py-3">
            <span className="text-2xl">🤖</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                Powered by Anthropic Claude
              </p>
              <p className="text-sm font-bold tracking-tight">
                Claude Sonnet 4.5 — Vision + Tool Use
              </p>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <InfoBlock
              num="01"
              title="Baca gambar kerja"
              desc="Sonnet menganalisa denah, tampak, potongan, dan detail. Membaca dimensi tertulis (panjang, lebar, tinggi) untuk hitung volume kasar."
            />
            <InfoBlock
              num="02"
              title="Susun WBS otomatis"
              desc="Menghasilkan struktur WBS standar konstruksi (Persiapan, Pondasi, Struktur, Atap, Finishing, MEP) dengan item per kategori."
            />
            <InfoBlock
              num="03"
              title="Match AHSP & confidence"
              desc="Tiap item disandingkan ke kandidat AHSP dari library 2.669+ item. Confidence (high/medium/low) menandai item yang perlu verifikasi."
            />
          </div>
        </section>

        {/* Tips PDF */}
        <section className="mb-6 rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight">
            <span>📄</span> Tips Menyiapkan PDF Gambar Kerja
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <ChecklistItem>
              <strong className="text-foreground">Gabung jadi satu PDF.</strong>{" "}
              Denah, tampak, potongan, dan detail digabung dalam satu file
              PDF (bukan terpisah-pisah).
            </ChecklistItem>
            <ChecklistItem>
              <strong className="text-foreground">
                Pastikan ada dimensi tertulis.
              </strong>{" "}
              Volume tergantung angka (panjang, lebar, tinggi) yang terbaca
              di gambar. Tanpa angka, AI tidak bisa menghitung.
            </ChecklistItem>
            <ChecklistItem>
              <strong className="text-foreground">Resolusi gambar bagus.</strong>{" "}
              Kalau di-scan, pastikan teks dan garis terbaca jelas (300 DPI
              minimum). Hindari hasil scan miring atau buram.
            </ChecklistItem>
            <ChecklistItem>
              <strong className="text-foreground">Maksimal 30 MB.</strong>{" "}
              Lebih dari itu, kompres dulu atau pisah jadi beberapa proyek.
            </ChecklistItem>
          </ul>
        </section>

        <AIImportClient projectId={project.id} />

        {/* Disclaimer */}
        <section className="mt-10 rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p className="mb-2 font-semibold text-foreground">
            ⚠ Disclaimer & Privasi
          </p>
          <ul className="list-disc space-y-1.5 pl-4">
            <li>
              AI menghasilkan estimasi volume <strong>kasar</strong>.
              Confidence rendah <em>wajib</em> diverifikasi manual sebelum
              dipakai.
            </li>
            <li>
              Untuk RAB final atau tender, engineer wajib mereview seluruh
              item dan menghitung ulang dengan dokumen detail.
            </li>
            <li>
              Pencocokan AHSP otomatis menggunakan keyword similarity — tidak
              selalu akurat. Pengguna bertanggung jawab memilih AHSP yang
              tepat.
            </li>
            <li>
              File PDF dikirim ke Claude API (Anthropic) untuk dianalisa.
              Setelah respons diterima, file langsung dihapus — tidak
              disimpan di server.
            </li>
          </ul>
        </section>
      </section>
    </AppShell>
  );
}

function InfoBlock({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <div>
      <p className="font-mono text-xs font-bold text-accent/80">{num}</p>
      <h3 className="mt-1 text-sm font-bold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {desc}
      </p>
    </div>
  );
}

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 leading-relaxed">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-accent"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}
