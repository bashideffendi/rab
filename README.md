# RABin

> Hitung RAB yang bisa dipertanggungjawabkan — tiap angka punya jejak ke regulasi sumbernya.

**Status:** Draft (foundation scaffolded)
**Live:** https://rabin.masbash.id _(belum deploy)_
**Repo:** https://github.com/bashideffendi/rabin _(belum push)_
**Stack:** Next.js 16, React 19, Tailwind v4, Postgres, Drizzle ORM, shadcn/ui

---

## What

RABin adalah tools online untuk menyusun Rencana Anggaran Biaya (RAB) konstruksi yang transparan dan bisa dipertanggungjawabkan.

Fokus:

1. **Trace-to-source** — tiap koefisien AHSP & harga material punya link ke regulasi sumber (Permen PUPR, SNI, e-katalog LKPP).
2. **Regional pricing** — harga material per kabupaten/kota dari HSPK pemda + BPS, bukan flat nasional.
3. **Red flag engine** — auto-warning kalau koefisien menyimpang signifikan dari standar PUPR atau harga di atas median e-katalog.
4. **Audit trail** — version history & comment thread per item, snapshot tiap revisi.
5. **Tender-ready output** — Excel + PDF formatnya cocok lampiran SPSE & BAP audit.

Target user primer: **PPK & Tim Teknis OPD** yang harus susun RAB lulus verifikasi.
Secondary: konsultan perencana proyek pemerintah, auditor & APIP sebagai validator.

## Roadmap

**v1 (MVP, ~4 minggu)**
- Project + WBS + item management
- AHSP database baseline (PUPR + SNI), read-only, source-traced
- Calculator inti (pilih AHSP, input volume)
- Trace-to-source link
- Export Excel basic

**v2 (~8 minggu)**
- Regional pricing (HSPK kabupaten + BPS)
- Red flag engine basic (rule-based)
- Audit trail / version history

**v3+**
- PDF tender-ready
- SiRUP integration (linking ke SIRUP-Audit project)
- Multi-user collaboration & comments

## Local Development

**Quickstart (Docker):**

```bash
git clone https://github.com/bashideffendi/rabin.git
cd rabin
npm install
cp .env.example .env.local

# Spin up Postgres lokal
docker compose up -d

# Set di .env.local:
#   DATABASE_URL="postgres://rabin:rabin@localhost:5432/rabin"

# Apply schema
npm run db:push

# Seed baseline AHSP samples + materials + harga (optional)
npm run db:seed

# Run dev
npm run dev
```

Buka http://localhost:3000

**Tanpa Docker** (Neon / Railway / Postgres existing):
Set `DATABASE_URL` ke connection string milikmu, skip `docker compose up`.

**Drizzle Studio** (DB browser GUI):

```bash
npm run db:studio
```

**Seed data note:** `npm run db:seed` populate 1 region (Nasional) + 16 materials + 6 AHSP items + komponen + harga representatif 2025. **Data ilustratif** berdasarkan format Permen PUPR No. 1/2022 — verify dengan dokumen resmi sebelum dipakai untuk RAB production. Seed idempotent: skip kalau sudah dijalankan.

## Environment Variables

| Var | Required | Default | Keterangan |
|---|---|---|---|
| `DATABASE_URL` | Yes | - | Postgres connection string |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public app URL |

## Deploy

- **Platform**: Railway (Next.js + Postgres add-on)
- **URL**: https://rabin.masbash.id
- **Auto-deploy**: setiap push ke `main`

## Tech Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- Tailwind CSS v4
- shadcn/ui (dark default, mono untuk numerik)
- PostgreSQL + Drizzle ORM
- Hosting: Railway

## License

Personal project. © Bashid Effendi 2026.
