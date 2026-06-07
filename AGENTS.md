<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# RABin — panduan agent (Claude Code / Codex / dll)

> File ini dibaca otomatis sama Codex (`AGENTS.md`) dan Claude Code (`CLAUDE.md` →
> `@AGENTS.md`). Satu sumber konteks buat semua agent yang ngerjain repo ini.

Kalkulator RAB (Rencana Anggaran Biaya) konstruksi online. **Stack:** Next.js 16
(App Router, Turbopack, Server Components/Actions) · React 19 · Tailwind v4 ·
Drizzle ORM · Supabase Postgres.

## Setup

1. `npm install`
2. `cp .env.example .env.local` → isi value-nya. Value asli minta ke pemilik repo
   lewat channel aman (password manager) — **jangan** commit `.env.local`.
3. DB: `npm run db:push` (dev, sync schema) atau `npm run db:migrate` (migration).
   Inspect: `npm run db:studio`.
4. Dev server: `npm run dev`. (⚠ berat di laptop low-RAM — pernah hard-crash.)
5. Jalanin script DB: `npx tsx --env-file=.env.local scripts/<nama>.ts`.

## Arsitektur — yang WAJIB dipahami sebelum nyentuh harga/total

- **Pricing** → `src/lib/pricing.ts` `computeAhspPrices(ahspIds, regionId?, asOf?)`
  adalah SATU-satunya pricer (region-aware two-pass + IKK + sanity-gate
  `isCorruptPrice`). Jangan bikin perhitungan harga ad-hoc di tempat lain.
- **Rekap total** → `src/lib/rekap.ts` `computeRekap(subtotal, cfg)` = satu sumber
  rumus (Subtotal → Overhead → SMKK → DPP → PPN → pembulatan). Dipakai UI, print,
  Excel export — biar total SELALU sama di mana pun.
- **Search AHSP** → `src/lib/ahsp-search.ts` `expandQuery()` (sinonim: K-225↔f'c,
  pembesian↔penulangan, dll). Tambah istilah baru di `SYNONYMS` / `PHRASE_SYNONYMS`.
- Harga material asalnya dari scrape `rabestimator.id` (basis Jakarta ÷ IKK 1,1926
  → nasional). Sumber sekunder; sebagian cenderung tinggi tapi konsisten + traceable.

## ⚠ GOTCHA: item RAB pakai SNAPSHOT, bukan relasi

`project_items` menampilkan nama/satuan/harga dari kolom **`customName` /
`customUnit` / `customUnitPrice`** (lihat `items-section.tsx`) — BUKAN dari relasi
`ahspItem`, dan BUKAN dihitung live. Jadi pas BIKIN item (walau ke-link AHSP),
**wajib snapshot**: `customName = nama`, `customUnit = satuan`,
`customUnitPrice = computeAhspPrices(...)`. Pola benar ada di `item-actions.ts`
`createItem`. Kalau kolom custom_* dibiarkan null → item tampil "(custom item)"
Rp 0 walau ahspItemId terisi. `ahspItemId` cuma dipakai buat badge kode AHSP.

## Konvensi

- **Bahasa** UI + komentar: Indonesia casual ("aku/kamu").
- **Git: branch per fitur → Pull Request.** `main` = **auto-deploy production**
  (Vercel) — jangan push eksperimen/WIP langsung ke `main`.
- Sebelum commit: `npx tsc --noEmit` (0 error) + `npm run lint` (clean).
- Repo ini **PUBLIC** → secret-scan sebelum push. `.env*` gitignored (kecuali
  `.env.example`). Jangan hardcode kredensial atau UUID user di file yang di-commit.
- Pola DB script: idempotent + dry-run dulu kalau nulis ke production DB.
