# RABin

> Hitung RAB rumah, renovasi, atau proyek konstruksi — rinci dan transparan, buat siapa aja.

**Status:** Draft
**Live:** https://rabin.masbash.id _(belum deploy)_
**Repo:** https://github.com/bashideffendi/rabin _(belum push)_
**Stack:** Next.js 16, React 19, Tailwind v4, Postgres, Drizzle ORM

---

## What

RABin adalah kalkulator RAB online buat siapa aja yang lagi nyusun anggaran konstruksi — pemilik rumah yang mau bangun/renovasi, konsultan perencana, kontraktor, estimator.

Yang bedain dari kalkulator RAB lain:

1. **Tiap angka jelas asalnya** — koefisien & harga material punya referensi ke standar resmi (Permen PUPR, SNI), klik untuk lihat sumbernya. Gak asal nempelin angka.
2. **Harga ngikut daerahmu** — pasir di Batam beda sama Aceh. Harga otomatis pakai data daerah (planned: HSPK pemda + BPS regional).
3. **Peringatan harga aneh** — kalau ada item yang melenceng jauh dari pasaran, ada warning otomatis (planned).
4. **Riwayat perubahan** — RAB direvisi? Ada catatan kapan & apanya (planned).
5. **Export Excel & PDF rapi** — siap kirim ke kontraktor atau lampiran kontrak (planned).

Target user:

- **Pemilik rumah / proyek pribadi** — mau bangun atau renovasi, mau tau detail biar gak ditipu kontraktor.
- **Konsultan perencana** — bikin RAB profesional dengan referensi yang bisa dipertanggungjawabkan ke klien.
- **Kontraktor / estimator** — submit penawaran konsisten dan transparan.

Secondary (bonus): PPK proyek pemerintah, auditor / APIP — output formatnya kompatibel dokumen tender SPSE.

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
