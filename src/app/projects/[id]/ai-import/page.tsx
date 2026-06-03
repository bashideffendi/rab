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
            Upload PDF Gambar Kerja, AI Susun Draft RAB
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Unggah PDF gambar kerja — AI akan baca denah, tampak, dan
            potongan, lalu menghasilkan Draft WBS beserta estimasi volume per
            item.
          </p>
        </header>

        {/* Info card: model + cara kerja */}
        <section className="mb-6 overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 via-card to-card shadow-sm">
          <div className="flex items-center justify-between border-b border-accent/20 bg-accent/5 px-5 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              ⚡ Powered by Anthropic
            </span>
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
              Vision · Tool Use · Bahasa Indonesia
            </span>
          </div>
          <div className="flex items-center gap-5 px-5 py-5 md:px-6">
            <div className="flex shrink-0 items-center justify-center rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/20 to-accent/5 p-4 shadow-sm">
              <RobotIcon />
            </div>
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                  Claude (Anthropic)
                </h2>
                <span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                  Vision AI
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Model multimodal Anthropic untuk membaca gambar kerja
                konstruksi dan menghasilkan struktur RAB yang siap di-review.
              </p>
            </div>
          </div>
          <div className="grid gap-4 border-t border-border p-5 md:grid-cols-3 md:p-6">
            <InfoBlock
              num="01"
              title="Baca gambar kerja"
              desc="AI menganalisa denah, tampak, potongan, dan detail. Membaca dimensi tertulis (panjang, lebar, tinggi) untuk menghitung volume kasar."
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

function RobotIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="text-accent"
    >
      <line
        x1="24"
        y1="4"
        x2="24"
        y2="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="3.5" r="1.8" fill="currentColor" />
      <rect
        x="8"
        y="9"
        width="32"
        height="26"
        rx="6"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <circle cx="17" cy="20" r="2.6" fill="currentColor" />
      <circle cx="31" cy="20" r="2.6" fill="currentColor" />
      <line
        x1="17"
        y1="28"
        x2="31"
        y2="28"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <rect
        x="3"
        y="17"
        width="4"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <rect
        x="41"
        y="17"
        width="4"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <line
        x1="13"
        y1="38"
        x2="35"
        y2="38"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="42"
        x2="28"
        y2="42"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
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
