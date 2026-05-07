export default function Home() {
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
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#fitur" className="hover:text-foreground">
              Fitur
            </a>
            <a href="#untuk-siapa" className="hover:text-foreground">
              Untuk Siapa
            </a>
            <a href="#roadmap" className="hover:text-foreground">
              Roadmap
            </a>
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
              Hitung RAB yang bisa{" "}
              <span className="text-accent">dipertanggung&shy;jawabkan.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Tiap koefisien & harga punya jejak ke regulasi sumbernya. Harga
              material regional per kabupaten. Anomali ke-flag otomatis. Output
              kompatibel dokumen tender pemerintah.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/projects"
                className="rounded border border-accent bg-accent px-5 py-2.5 text-sm font-medium text-black hover:bg-accent/90"
              >
                Buka Workspace &rarr;
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
              5 hal yang gak ada di tools RAB lain
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
    tag: "Trace",
    title: "Trace-to-source",
    desc: "Tiap koefisien & harga ada link langsung ke Permen PUPR, SNI, atau e-katalog LKPP. Klik, lihat sumbernya.",
  },
  {
    tag: "Region",
    title: "Harga regional per kabupaten",
    desc: "Harga material dari HSPK pemda + BPS regional. Bukan flat nasional yang gak masuk akal.",
  },
  {
    tag: "Anomaly",
    title: "Red flag engine",
    desc: "Auto-warning kalau koefisien menyimpang dari standar PUPR atau harga di atas median e-katalog.",
  },
  {
    tag: "Audit",
    title: "Audit trail native",
    desc: "Version history, snapshot tiap revisi, comment thread per item. Reviewer lihat siapa ubah apa.",
  },
  {
    tag: "Output",
    title: "Tender-ready export",
    desc: "Excel + PDF dengan kolom referensi regulasi siap lampiran SPSE atau dokumen audit BPK.",
  },
  {
    tag: "Soon",
    title: "SiRUP integration",
    desc: "Tarik paket dari SiRUP, generate template RAB-nya. Ekosistem dengan tools audit lain.",
  },
];

const audiences = [
  {
    role: "PPK & Tim Teknis OPD",
    note: "Susun RAB yang lulus verifikasi tanpa takut salah audit. Tiap angka udah ada referensi regulasinya.",
  },
  {
    role: "Konsultan Perencana",
    note: "Bikin RAB proyek pemerintah dengan format yang langsung kompatibel dokumen tender.",
  },
  {
    role: "Auditor & APIP",
    note: "Validasi RAB klien dengan referensi regulasi yang udah ke-link, plus indikator anomali otomatis.",
  },
];

const roadmap = [
  {
    version: "v1",
    status: "now" as const,
    items:
      "Project + WBS, AHSP database baseline (PUPR + SNI), calculator inti, trace-to-source, export Excel.",
  },
  {
    version: "v2",
    status: "next" as const,
    items:
      "Regional pricing per kabupaten, red flag engine rule-based, audit trail & version history.",
  },
  {
    version: "v3",
    status: "next" as const,
    items:
      "PDF tender-ready, SiRUP integration, multi-user collaboration, comment thread.",
  },
];
