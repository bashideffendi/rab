import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">
              <span className="text-accent">RAB</span>in
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm sm:gap-7">
            <a
              href="#fitur"
              className="hidden text-muted-foreground hover:text-foreground sm:inline"
            >
              Fitur
            </a>
            <a
              href="#cara-kerja"
              className="hidden text-muted-foreground hover:text-foreground sm:inline"
            >
              Cara Kerja
            </a>
            <a
              href="#untuk-siapa"
              className="hidden text-muted-foreground hover:text-foreground sm:inline"
            >
              Untuk Siapa
            </a>
            {user ? (
              <>
                <Link
                  href="/projects"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Workspace
                </Link>
                <Link
                  href="/account"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Akun
                </Link>
                <span
                  className="hidden font-mono text-xs text-muted-foreground sm:inline"
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
                  className="text-muted-foreground hover:text-foreground"
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

      <main className="flex-1">
        {/* Hero */}
        <section className="px-6 pt-10 pb-16 md:pt-14 md:pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                RAB Online · Konstruksi Indonesia
              </p>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
                Susun RAB profesional —
                <br />
                <span className="text-accent">
                  rinci, transparan, sesuai standar.
                </span>
              </h1>
              <ul className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
                <HeroBullet
                  title="AHSP 2026 Permen PUPR"
                  desc="Koefisien resmi versi terbaru — dapat dilacak ke pasal sumber."
                />
                <HeroBullet
                  title="Harga menyesuaikan IKK BPS"
                  desc="Indeks Kemahalan Konstruksi per provinsi diterapkan otomatis."
                />
                <HeroBullet
                  title="Generate RAB dengan AI"
                  desc="Upload gambar kerja PDF — AI susun Draft WBS dan estimasi volume."
                />
                <HeroBullet
                  title="Export Excel & PDF profesional"
                  desc="Multi-sheet Excel dan PDF rapi — siap dilampirkan ke kontrak."
                />
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href={user ? "/projects" : "/signup"}
                  className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90"
                >
                  {user ? "Buka Workspace →" : "Mulai Gratis →"}
                </Link>
                <a
                  href="#cara-kerja"
                  className="rounded-md border border-border px-6 py-3 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                >
                  Lihat Cara Kerja
                </a>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Gratis · Tanpa kartu kredit · Berbasis web — langsung pakai di
                browser
              </p>
            </div>

            {/* Stats banner */}
            <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
              <Stat label="AHSP 2026" value="2.669+" />
              <Stat label="IKK BPS" value="34 Provinsi" />
              <Stat label="Sumber" value="Permen PUPR" />
              <Stat label="Export" value="Excel · PDF" />
            </div>
          </div>
        </section>

        {/* Fitur */}
        <section
          id="fitur"
          className="border-t border-border bg-muted/30 px-6 py-20"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Fitur Inti
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Semua kebutuhan RAB dalam satu workspace.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Dari struktur pekerjaan, perhitungan harga otomatis, sampai
                export profesional — semuanya terintegrasi tanpa pindah-pindah
                aplikasi.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <article
                  key={f.title}
                  className="bg-background p-6 transition-colors hover:bg-muted/40"
                >
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="text-2xl">{f.icon}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mb-2 text-base font-semibold tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Cara kerja */}
        <section id="cara-kerja" className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Cara Kerja
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Tiga langkah dari awal sampai export.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Tidak butuh training panjang. Buka, isi, ekspor.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <div
                  key={s.title}
                  className="relative rounded-lg border border-border bg-card p-6 shadow-sm"
                >
                  <span className="font-mono text-3xl font-bold text-accent/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-base font-semibold tracking-tight">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Untuk siapa */}
        <section
          id="untuk-siapa"
          className="border-t border-border bg-muted/30 px-6 py-20"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Cocok Untuk
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Dipakai siapa saja yang butuh RAB.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {audiences.map((a) => (
                <article
                  key={a.role}
                  className="rounded-lg border border-border bg-background p-6 shadow-sm"
                >
                  <span className="text-3xl">{a.icon}</span>
                  <h3 className="mt-4 text-base font-semibold tracking-tight">
                    {a.role}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {a.note}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA bawah */}
        <section className="border-t border-border px-6 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Siap susun RAB pertamamu?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Daftar gratis hari ini. Tidak perlu kartu kredit, tidak perlu
              instalasi. Tinggal buka browser dan mulai bekerja.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={user ? "/projects" : "/signup"}
                className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90"
              >
                {user ? "Buka Workspace →" : "Daftar Gratis →"}
              </Link>
              {!user && (
                <Link
                  href="/login"
                  className="rounded-md border border-border px-6 py-3 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                >
                  Sudah Punya Akun? Login
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 text-xs text-muted-foreground md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">
              <span className="text-accent">RAB</span>in
            </span>
            <span>·</span>
            <span>RAB online untuk konstruksi Indonesia</span>
          </div>
          <p className="font-mono">
            Bagian dari{" "}
            <a
              href="https://masbash.id"
              className="text-accent hover:underline"
            >
              masbash.id
            </a>{" "}
            · &copy; 2026
          </p>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tracking-tight md:text-2xl">
        {value}
      </p>
    </div>
  );
}

function HeroBullet({ title, desc }: { title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
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
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
          {desc}
        </p>
      </div>
    </li>
  );
}

const features = [
  {
    icon: "📚",
    title: "AHSP 2026 Permen PUPR",
    desc: "Library 2.669+ item dari Analisis Harga Satuan Pekerjaan versi 2026 — Permen PUPR dan SE DJBK. Tiap item dapat dilacak ke pasal sumber resmi.",
  },
  {
    icon: "📍",
    title: "Harga regional via IKK BPS",
    desc: "Indeks Kemahalan Konstruksi BPS per provinsi (34 wilayah) diterapkan otomatis. Anggaran di Aceh, Batam, atau Papua menyesuaikan kondisi pasar setempat.",
  },
  {
    icon: "🤖",
    title: "Generate RAB dengan AI",
    desc: "Upload gambar kerja PDF (denah, tampak, potongan). AI membaca dan menyusun Draft WBS lengkap dengan estimasi volume. Review dan terapkan dalam beberapa klik.",
  },
  {
    icon: "📊",
    title: "Export Excel & PDF profesional",
    desc: "Hasil RAB lengkap dengan rekapitulasi, terbilang, dan PPN — Excel multi-sheet atau PDF rapi siap dilampirkan ke kontrak atau dokumen tender.",
  },
  {
    icon: "📅",
    title: "Time Schedule + Gantt Chart",
    desc: "Tentukan minggu mulai dan durasi tiap pekerjaan. Bobot dihitung otomatis dari nilai item. Visualisasi Gantt tersedia tanpa setup tambahan.",
  },
  {
    icon: "📁",
    title: "Template proyek siap pakai",
    desc: "Mulai dari template umum (rumah satu lantai, renovasi, ruko dua lantai). Salin ke project baru, lalu sesuaikan dengan kebutuhan proyek.",
  },
];

const audiences = [
  {
    icon: "🏠",
    role: "Pemilik Proyek",
    note: "Mau bangun atau renovasi rumah? Susun RAB sendiri sebelum mengundang kontraktor. Lebih jelas budget, lebih kuat saat negosiasi, lebih kebal mark-up.",
  },
  {
    icon: "📐",
    role: "Konsultan & Estimator",
    note: "Susun RAB dengan referensi yang bisa dipertanggungjawabkan ke klien. Hemat waktu — tidak perlu mulai dari Excel kosong setiap proyek baru.",
  },
  {
    icon: "🏗️",
    role: "Kontraktor",
    note: "Submit penawaran dengan basis perhitungan transparan. Klien lebih percaya saat tiap angka bisa dijelaskan sumbernya — dari koefisien sampai harga material.",
  },
];

const steps = [
  {
    title: "Daftar & buat project",
    desc: "Daftar gratis, lalu isi data proyek: nama, lokasi, klien, dan tahun. Sistem menyiapkan workspace dengan konfigurasi default (PPN 11%, pembulatan Rp 1.000).",
  },
  {
    title: "Susun WBS & item RAB",
    desc: "Bangun struktur pekerjaan (Work Breakdown Structure). Pilih item dari library AHSP atau buat custom. Input volume — harga otomatis dihitung dari koefisien dan harga material.",
  },
  {
    title: "Schedule & export",
    desc: "Tentukan timeline pengerjaan tiap item, lihat Gantt chart otomatis. Generate Excel atau PDF profesional — siap dikirim ke klien atau dilampirkan ke kontrak.",
  },
];
