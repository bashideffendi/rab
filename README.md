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

```bash
git clone https://github.com/bashideffendi/rabin.git
cd rabin
npm install
cp .env.example .env.local
# isi DATABASE_URL ke Postgres lokal/Railway
npm run db:push    # sync schema (kalau Drizzle udah ada)
npm run dev
```

Buka http://localhost:3000

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
