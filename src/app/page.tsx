import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-accent">▲</span>
            <span className="font-semibold tracking-tight">RABin</span>
            <span className="ml-2 rounded border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Draft
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground sm:gap-6">
            <a
              href="#fitur"
              className="hidden hover:text-foreground sm:inline"
            >
              Fitur
            </a>
            <a
              href="#untuk-siapa"
              className="hidden hover:text-foreground sm:inline"
            >
              Untuk Siapa
            </a>
            {user ? (
              <>
                <a
                  href="/projects"
                  className="hover:text-foreground"
                >
                  Workspace
                </a>
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
                <a href="/login" className="hover:text-foreground">
                  Login
                </a>
                <a
                  href="/signup"
                  className="rounded border border-accent px-3 py-1 text-accent hover:bg-accent hover:text-black"
                >
                  Daftar
                </a>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-3xl">
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">
              RAB Online &mdash; Indonesia
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight break-words md:text-5xl">
              Hitung RAB rumah, renovasi,
              <br />
              atau proyek konstruksi —{" "}
              <span className="text-accent">rinci & transparan.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Tiap angka jelas asalnya. Harga ngikut daerahmu. Peringatan
              otomatis kalau ada item yang harganya gak wajar. Buat siapa aja
              — pemilik rumah, konsultan, kontraktor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/projects"
                className="rounded border border-accent bg-accent px-5 py-2.5 text-sm font-medium text-black hover:bg-accent/90"
              >
                Mulai Bikin RAB &rarr;
              </a>
              <a
                href="#fitur"
                className="rounded border border-border px-5 py-2.5 text-sm font-medium hover:border-accent hover:text-accent"
              >
                Lihat Fitur
              </a>
            </div>
          </div>
        </section>

        <section
          id="fitur"
          className="border-t border-border bg-muted/30 px-6 py-20"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-12 text-2xl font-semibold tracking-tight">
              Apa bedanya sama kalkulator RAB lain?
            </h2>
            <div className="grid gap-px overflow-hidden rounded border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className="bg-background p-6 transition-colors hover:bg-muted/50"
                >
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="font-mono text-xs text-muted-foreground">
                      0{i + 1}
                    </span>
                    <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {f.tag}
                    </span>
                  </div>
                  <h3 className="mb-2 font-semibold tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="untuk-siapa" className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-12 text-2xl font-semibold tracking-tight">
              Untuk siapa
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {audiences.map((a) => (
                <div
                  key={a.role}
                  className="rounded border border-border p-6"
                >
                  <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">
                    {a.role}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {a.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="roadmap"
          className="border-t border-border bg-muted/30 px-6 py-20"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-12 text-2xl font-semibold tracking-tight">
              Roadmap
            </h2>
            <div className="space-y-px overflow-hidden rounded border border-border bg-border">
              {roadmap.map((r) => (
                <div
                  key={r.version}
                  className="flex flex-col gap-2 bg-background p-5 md:flex-row md:items-center md:gap-8"
                >
                  <div className="flex w-32 shrink-0 items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-accent">
                      {r.version}
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        r.status === "now"
                          ? "border-accent text-accent"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {r.status === "now" ? "Active" : "Planned"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.items}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 text-xs text-muted-foreground md:flex-row md:items-center">
          <p className="font-mono">
            rabin.masbash.id &mdash; bagian dari{" "}
            <a
              href="https://masbash.id"
              className="text-accent hover:underline"
            >
              masbash.id
            </a>{" "}
            ecosystem
          </p>
          <p>&copy; 2026 Bashid Effendi</p>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    tag: "Transparan",
    title: "Tiap angka jelas asalnya",
    desc: "Koefisien & harga punya referensi ke standar resmi (Permen PUPR, SNI). Klik, lihat sumbernya — gak asal nempelin angka.",
  },
  {
    tag: "Lokal",
    title: "Harga ngikut daerahmu",
    desc: "Pasir di Batam beda sama di Aceh, semen juga. Harga otomatis pakai data daerah, bukan flat nasional.",
  },
  {
    tag: "Cek wajar",
    title: "Peringatan harga aneh",
    desc: "Kalau ada item yang harganya melenceng jauh dari pasaran, ada warning otomatis. Biar gak ke-mark-up tanpa sadar.",
  },
  {
    tag: "Riwayat",
    title: "Catatan perubahan",
    desc: "RAB direvisi? Ada riwayat kapan & apanya yang diubah. Kalau ditanya pas meeting, gampang jawabnya.",
  },
  {
    tag: "Export",
    title: "Excel & PDF rapi",
    desc: "Hasil siap dikirim ke kontraktor, dilampirin ke kontrak, atau dibawa ke meeting. Format profesional, langsung pakai.",
  },
  {
    tag: "Soon",
    title: "Template proyek",
    desc: "Mulai dari template umum (rumah 1 lantai, renovasi dapur, ruko 2 lantai) biar gak mulai dari nol.",
  },
];

const audiences = [
  {
    role: "Pemilik Rumah / Proyek",
    note: "Mau bangun atau renovasi? Bikin RAB sendiri biar tau detailnya sebelum kontraktor masuk. Lebih kebal dari mark-up.",
  },
  {
    role: "Konsultan Perencana",
    note: "Bikin RAB profesional dengan referensi yang bisa kamu pertanggungjawabkan ke klien. Hemat waktu, gak harus mulai dari Excel kosong.",
  },
  {
    role: "Kontraktor & Estimator",
    note: "Submit penawaran konsisten dan transparan. Klien lebih percaya kalau angkanya bisa dijelasin sumbernya.",
  },
];

const roadmap = [
  {
    version: "v1",
    status: "now" as const,
    items:
      "Bikin project, struktur pekerjaan, kalkulator RAB pakai AHSP standar atau item custom, total otomatis.",
  },
  {
    version: "v2",
    status: "next" as const,
    items:
      "Harga material per daerah (kabupaten/kota), peringatan harga aneh otomatis, riwayat perubahan.",
  },
  {
    version: "v3",
    status: "next" as const,
    items:
      "Export Excel & PDF rapi, template proyek umum (rumah, renovasi, ruko), berbagi RAB ke kontraktor.",
  },
];
