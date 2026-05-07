import * as cheerio from "cheerio";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Scrape AHSP data dari rabestimator.id (kepunyaan user).
 *
 * Two phases:
 * 1. DISCOVER: loop listing pages 1..N, extract { id, kode, judul, satuan, harga, sumber }
 * 2. DETAIL: untuk tiap id, fetch /koleksi/ahsp/{id}, parse komponen tenaga/bahan/alat
 *
 * Resumable: simpan progress ke JSON intermediate, skip yang udah ke-fetch.
 *
 * Run: npx tsx scripts/scrape-rabestimator.ts
 */

const BASE = "https://rabestimator.id";
const LISTING_PATH = "/koleksi/ahsp";
const DELAY_MS = 250;
const USER_AGENT = "Mozilla/5.0 (compatible; rabin-importer/1.0)";

const DATA_DIR = resolve(process.cwd(), "data");
const LISTING_FILE = resolve(DATA_DIR, "rabestimator-listing.json");
const DETAIL_FILE = resolve(DATA_DIR, "rabestimator-detail.json");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

type ListingEntry = {
  id: number;
  kode: string;
  judul: string;
  satuan: string;
  hargaText: string;
  sumber: string;
};

type Component = {
  type: "tenaga" | "bahan" | "alat";
  nama: string;
  koefisien: string;
  satuan: string;
  hargaSatuan: string; // raw text "Rp 180.000" — parse later
};

type DetailEntry = {
  id: number;
  kode: string;
  nama: string;
  satuan: string;
  components: Component[];
  totalText?: string;
  sumber?: string;
};

async function fetchHtml(url: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (res.status === 404) {
        const err = new Error(`404: ${url}`) as Error & { status?: number };
        err.status = 404;
        throw err;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return await res.text();
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 404) throw e;
      if (attempt === retries - 1) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw new Error("unreachable");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseListingPage(html: string): ListingEntry[] {
  const $ = cheerio.load(html);
  const out: ListingEntry[] = [];
  $("table tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 6) return;
    // Find id from any href containing /koleksi/ahsp/{id}
    let id = 0;
    $(tr)
      .find("a[href*='/koleksi/ahsp/']")
      .each((__, a) => {
        const href = $(a).attr("href") ?? "";
        const m = href.match(/\/koleksi\/ahsp\/(\d+)/);
        if (m && id === 0) id = Number(m[1]);
      });
    if (!id) return;

    const kode = $(tds.get(1)).text().trim();
    const judul = $(tds.get(2)).text().trim();
    const satuan = $(tds.get(3)).text().trim();
    const hargaText = $(tds.get(4)).text().trim();
    const sumber = $(tds.get(5)).text().trim();

    out.push({ id, kode, judul, satuan, hargaText, sumber });
  });
  return out;
}

function parseTotalPages(html: string): number {
  const $ = cheerio.load(html);
  // Heuristic: pagination has links/buttons, find max page number visible
  let max = 1;
  $("a, button, span").each((_, el) => {
    const t = $(el).text().trim();
    const n = Number(t);
    if (Number.isFinite(n) && n > max && n < 10000) max = n;
  });
  // Also check href params ?page=N
  const m = html.match(/[?&]page=(\d+)/g);
  if (m) {
    for (const s of m) {
      const n = Number(s.replace(/[^\d]/g, ""));
      if (n > max) max = n;
    }
  }
  return max;
}

const LISTING_META_FILE = resolve(DATA_DIR, "rabestimator-listing.meta.json");

async function discoverListing(): Promise<ListingEntry[]> {
  // Resume cuma kalau metadata punya complete=true
  if (existsSync(LISTING_FILE) && existsSync(LISTING_META_FILE)) {
    const meta = JSON.parse(readFileSync(LISTING_META_FILE, "utf8"));
    if (meta?.complete === true) {
      const data = JSON.parse(
        readFileSync(LISTING_FILE, "utf8"),
      ) as ListingEntry[];
      console.log(`✓ Resume listing: ${data.length} entries from cache (complete).`);
      return data;
    }
    console.log(
      `⚠ Cache listing exists but incomplete (meta.complete != true). Re-running.`,
    );
  }

  console.log("→ Phase 1: DISCOVER listing pages...");
  const firstHtml = await fetchHtml(`${BASE}${LISTING_PATH}?page=1`);
  const totalPages = parseTotalPages(firstHtml);
  console.log(`   Total pages: ${totalPages}`);

  const all: ListingEntry[] = [];
  const firstBatch = parseListingPage(firstHtml);
  all.push(...firstBatch);
  console.log(`   Page 1: ${firstBatch.length} entries`);

  for (let page = 2; page <= totalPages; page++) {
    await sleep(DELAY_MS);
    try {
      const html = await fetchHtml(`${BASE}${LISTING_PATH}?page=${page}`);
      const batch = parseListingPage(html);
      all.push(...batch);
      if (page % 10 === 0 || page === totalPages) {
        console.log(`   Page ${page}/${totalPages}: ${all.length} total`);
        writeFileSync(LISTING_FILE, JSON.stringify(all, null, 2));
        writeFileSync(
          LISTING_META_FILE,
          JSON.stringify({
            lastPage: page,
            totalPages,
            count: all.length,
            complete: false,
          }),
        );
      }
    } catch (e) {
      console.log(`   ⚠ Page ${page} error: ${(e as Error).message}`);
    }
  }

  writeFileSync(LISTING_FILE, JSON.stringify(all, null, 2));
  writeFileSync(
    LISTING_META_FILE,
    JSON.stringify({
      totalPages,
      count: all.length,
      complete: true,
      finishedAt: new Date().toISOString(),
    }),
  );
  console.log(`✓ Listing saved: ${all.length} entries → ${LISTING_FILE}`);
  return all;
}

function parseDetailPage(
  html: string,
  id: number,
  kodeFromListing: string,
  satuanFromListing: string,
): DetailEntry | null {
  const $ = cheerio.load(html);

  // Nama (judul AHSP) — h1 paling atas
  const nama = $("h1").first().text().trim();

  const kode = kodeFromListing;
  const satuan = satuanFromListing || extractSatuanFromTitle(nama);

  // Components: tabel detail biasanya ada banyak <table>, salah satunya tabel
  // analisa harga dengan section header berupa <tr><td colspan>A. Tenaga
  // Kerja</td></tr>. Iterate semua tabel + cari yang punya pattern itu.
  const components: Component[] = [];

  $("table").each((_, table) => {
    let currentType: Component["type"] | null = null;
    $(table)
      .find("tr")
      .each((__, tr) => {
        const tds = $(tr).find("td");
        if (tds.length === 0) return;

        // Cek apakah row ini section header (td pertama colspan)
        const firstTd = $(tds.get(0));
        const colspan = firstTd.attr("colspan");
        if (colspan && tds.length === 1) {
          const labelText = firstTd.text().trim().toLowerCase();
          if (/tenaga\s+kerja|^a\.\s*tenaga/i.test(labelText))
            currentType = "tenaga";
          else if (/^b\.\s*bahan|^bahan\b/i.test(labelText))
            currentType = "bahan";
          else if (
            /^c\.\s*peralatan|^peralatan|^alat\b/i.test(labelText)
          )
            currentType = "alat";
          else if (/jumlah|total|sub.?total|overhead/i.test(labelText)) {
            currentType = null; // skip total rows
          }
          return;
        }

        // Component row: must have currentType + min 3 cells
        if (!currentType || tds.length < 3) return;

        const cellTexts = tds.map((___, td) => $(td).text().trim()).get();
        const nama = cellTexts[0];
        const satuanCell = cellTexts[1] ?? "";
        const koefCell = cellTexts[2] ?? "";
        const hargaCell = cellTexts[3] ?? "";

        // Skip kalau nama empty atau total-row pattern
        if (!nama || /jumlah|sub.?total|total/i.test(nama)) return;
        if (!koefCell.match(/[\d.,]/)) return; // skip kalau koef gak numerik

        components.push({
          type: currentType,
          nama,
          satuan: satuanCell,
          koefisien: koefCell,
          hargaSatuan: hargaCell,
        });
      });
  });

  if (components.length === 0) return null;

  return {
    id,
    kode,
    nama,
    satuan,
    components,
  };
}

function extractSatuanFromTitle(nama: string): string {
  const m = nama.match(/\d+\s*(m'|m1|m2|m3|kg|unit|ton|liter|titik|buah|lembar|jam|OH)\b/i);
  return m ? m[1].toLowerCase() : "";
}

async function fetchDetails(listing: ListingEntry[]): Promise<DetailEntry[]> {
  let cached: DetailEntry[] = [];
  if (existsSync(DETAIL_FILE)) {
    cached = JSON.parse(readFileSync(DETAIL_FILE, "utf8")) as DetailEntry[];
    console.log(`✓ Resume details: ${cached.length} cached.`);
  }
  const cachedIds = new Set(cached.map((d) => d.id));

  const remaining = listing.filter((l) => !cachedIds.has(l.id));
  console.log(
    `→ Phase 2: DETAIL — ${remaining.length} to fetch (${cached.length} cached, ${listing.length} total).`,
  );

  const results = [...cached];
  let count = 0;
  for (const entry of remaining) {
    await sleep(DELAY_MS);
    try {
      const html = await fetchHtml(`${BASE}${LISTING_PATH}/${entry.id}`);
      const detail = parseDetailPage(
        html,
        entry.id,
        entry.kode,
        entry.satuan,
      );
      if (detail) {
        results.push(detail);
      } else {
        console.log(`   ⚠ ${entry.id} (${entry.kode}): no components parsed`);
        results.push({
          id: entry.id,
          kode: entry.kode,
          nama: entry.judul,
          satuan: entry.satuan,
          components: [],
        });
      }
      count++;
      if (count % 50 === 0 || count === remaining.length) {
        console.log(
          `   ${count}/${remaining.length} fetched (total saved: ${results.length})`,
        );
        writeFileSync(DETAIL_FILE, JSON.stringify(results, null, 2));
      }
    } catch (e) {
      const err = e as Error & { status?: number };
      console.log(
        `   ✗ ${entry.id}: ${err.message}${err.status === 404 ? " (skip)" : ""}`,
      );
    }
  }

  writeFileSync(DETAIL_FILE, JSON.stringify(results, null, 2));
  console.log(`✓ Details saved: ${results.length} → ${DETAIL_FILE}`);
  return results;
}

async function main() {
  const listing = await discoverListing();
  await fetchDetails(listing);
  console.log("\n✓ Scrape selesai.");
  console.log(`  Listing: ${LISTING_FILE}`);
  console.log(`  Details: ${DETAIL_FILE}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
