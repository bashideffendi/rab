/**
 * KLASIFIKASI material harga-tinggi: KORUP (parser/sumber) vs WAJAR (alat berat
 * / equipment MEP). Heuristik:
 *
 *  - Material "raw" satuan VOLUMETRIK/LINIER/BERAT (m3, kg, m, m2, btg, sak,
 *    zak, lbr, liter) yang harganya di atas plafon wajar = KORUP. Material curah
 *    bangunan gak ada yang > beberapa juta per satuan ini.
 *      plafon: kg/liter 200rb · m3 3jt · m/m2 2jt · btg 5jt · lbr/sak/zak 1jt
 *  - Material satuan "unit/set/buah/ls" → ekuipmen; harga puluhan-ratusan juta
 *    WAJAR (genset, pompa, STP, panel, lift). TIDAK diflag korup, hanya dicatat
 *    sebagai "equipment mahal (verifikasi manual)".
 *  - "Galian tanah*" sebagai bahan = salah klas (harusnya komposit tenaga+alat);
 *    diflag khusus.
 *
 * Output: dua daftar (KORUP-fixable + EQUIPMENT-review) + saran harga benar
 * berbasis median peer (material lain dengan name-stem sama).
 *
 *   node --env-file=.env.local --import tsx scripts/audit-corrupt-materials.ts
 * READ-ONLY.
 */
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const fmt = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

const RAW_UNIT_CEIL: Record<string, number> = {
  kg: 200_000,
  liter: 200_000,
  ltr: 200_000,
  m3: 3_000_000,
  "m³": 3_000_000,
  m: 2_000_000,
  m1: 2_000_000,
  "m'": 2_000_000,
  m2: 2_000_000,
  "m²": 2_000_000,
  btg: 5_000_000,
  batang: 5_000_000,
  lbr: 1_000_000,
  lembar: 1_000_000,
  sak: 1_000_000,
  zak: 1_000_000,
  buah: 30_000_000, // buah bisa lumayan (kloset, pompa kecil); plafon longgar
  bh: 30_000_000,
};
const EQUIP_UNITS = new Set(["unit", "set", "ls", "titik"]);

type Row = {
  mid: string;
  mcode: string;
  mname: string;
  mtype: string;
  munit: string;
  price: string | null;
};

async function main() {
  const rows = (await sql`
    SELECT m.id AS mid, m.code AS mcode, m.name AS mname, m.type AS mtype,
           m.unit AS munit, mp.price::text AS price
    FROM materials m
    LEFT JOIN material_prices mp
      ON mp.material_id = m.id AND mp.region_id IS NULL
  `) as unknown as Row[];

  const corrupt: { r: Row; ceil: number }[] = [];
  const equip: Row[] = [];
  const galian: Row[] = [];

  for (const r of rows) {
    if (r.price == null) continue;
    const price = Number(r.price);
    const u = r.munit.toLowerCase().replace(/['`]/g, "").trim();
    if (/galian/i.test(r.mname) && r.mtype === "bahan") {
      galian.push(r);
      continue;
    }
    const ceil = RAW_UNIT_CEIL[u];
    if (ceil != null) {
      if (price > ceil) corrupt.push({ r, ceil });
    } else if (EQUIP_UNITS.has(u)) {
      if (price > 30_000_000) equip.push(r);
    } else {
      // unit tak dikenal & harga ekstrem
      if (price > 50_000_000) equip.push(r);
    }
  }

  corrupt.sort((a, b) => Number(b.r.price) - Number(a.r.price));
  equip.sort((a, b) => Number(b.price) - Number(a.price));

  console.log(`\n${"=".repeat(74)}`);
  console.log(`KORUP — material curah/raw dgn harga mustahil (FIXABLE): ${corrupt.length}`);
  console.log("=".repeat(74));
  for (const { r, ceil } of corrupt) {
    // cari median peer berdasarkan stem nama (kata2 sebelum angka/diameter)
    const stem = r.mname.toLowerCase().replace(/[0-9].*$/, "").trim().split(/\s+/).slice(0, 2).join(" ");
    const peers = (await sql`
      SELECT mp.price::text AS price
      FROM materials m JOIN material_prices mp ON mp.material_id = m.id AND mp.region_id IS NULL
      WHERE m.unit = ${r.munit} AND lower(m.name) LIKE ${stem + "%"}
        AND mp.price::numeric <= ${ceil}
    `) as unknown as { price: string }[];
    const peerVals = peers.map((p) => Number(p.price)).sort((a, b) => a - b);
    const median = peerVals.length ? peerVals[Math.floor(peerVals.length / 2)] : null;
    console.log(
      `  ${r.mcode.padEnd(15)} [${r.mtype}/${r.munit}] ${r.mname.slice(0, 38).padEnd(38)} ${fmt(
        Number(r.price),
      ).padStart(18)}  | plafon ${fmt(ceil)}  | peer~${median != null ? fmt(median) : "?"} (n=${peerVals.length})`,
    );
  }

  console.log(`\n${"=".repeat(74)}`);
  console.log(`GALIAN sebagai 'bahan' (salah klasifikasi): ${galian.length}`);
  console.log("=".repeat(74));
  for (const r of galian) {
    console.log(
      `  ${r.mcode.padEnd(15)} [${r.mtype}/${r.munit}] ${r.mname.slice(0, 40).padEnd(40)} ${fmt(Number(r.price)).padStart(18)}`,
    );
  }

  console.log(`\n${"=".repeat(74)}`);
  console.log(`EQUIPMENT mahal satuan unit/set (WAJAR, verifikasi manual): ${equip.length}`);
  console.log("=".repeat(74));
  for (const r of equip) {
    console.log(
      `  ${r.mcode.padEnd(15)} [${r.mtype}/${r.munit}] ${r.mname.slice(0, 44).padEnd(44)} ${fmt(Number(r.price)).padStart(18)}`,
    );
  }

  await sql.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
