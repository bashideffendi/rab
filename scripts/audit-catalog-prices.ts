/**
 * AUDIT HARGA KATALOG AHSP — deteksi item dengan HSP absurd / nol.
 *
 * Untuk SEMUA ahsp_items: hitung HSP via computeAhspPrices([id], null) (basis
 * nasional, tanpa IKK region). Flag yang absurd berdasarkan unit:
 *   - m2      > Rp 20 jt
 *   - m'/m1   > Rp 10 jt
 *   - m3      > Rp  5 jt   (kecuali beton mutu tinggi ~ wajar 1.5jt; 5jt sudah liar)
 *   - unit/bh/buah/ls/titik/set > Rp 100 jt
 *   - kg      > Rp 500 rb
 *   - HARGA 0  untuk item yang punya komponen (harusnya berharga)
 *
 * Untuk tiap item rusak: query komponen (ahsp_components ⋈ materials ⋈
 * material_prices) dan ranking kontribusi (koef × harga). Surface komponen biang
 * kerok + harga material yang outlier (kandidat korupsi ×1000 / mis-parse).
 *
 * Jalankan:
 *   node --env-file=.env.local --import tsx scripts/audit-catalog-prices.ts
 *   (opsional) ... scripts/audit-catalog-prices.ts 6.2.1.7    # drill 1 kode
 *
 * READ-ONLY: tidak menulis apa pun ke DB.
 */
import { computeAhspPrices, getLatestMaterialPrices } from "../src/lib/pricing";
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";

// Ambang absurd per-unit (HSP biaya langsung, basis nasional, IDR).
function thresholdFor(unit: string): { max: number; label: string } | null {
  const u = unit.toLowerCase().replace(/['`]/g, "").trim();
  if (["m2", "m²"].includes(u)) return { max: 20_000_000, label: "m2" };
  if (["m1", "m'", "m’", "m", "meter"].includes(u))
    return { max: 10_000_000, label: "m'" };
  if (["m3", "m³"].includes(u)) return { max: 5_000_000, label: "m3" };
  if (["kg"].includes(u)) return { max: 500_000, label: "kg" };
  if (
    ["unit", "bh", "buah", "ls", "titik", "set", "ttk", "lb", "lembar", "btg"].includes(
      u,
    )
  )
    return { max: 100_000_000, label: "unit/bh" };
  // unit tak dikenal → pakai ambang konservatif besar biar gak false-positive
  return { max: 100_000_000, label: u || "?" };
}

const fmt = (n: number) =>
  "Rp " + Math.round(n).toLocaleString("id-ID");

type ItemRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
};

async function drillComponents(ahspId: string) {
  // PENTING: pakai getLatestMaterialPrices (jalur produksi, two-pass region
  // dedup) supaya breakdown per-komponen KONSISTEN dengan total computeAhspPrices.
  const comps = await db
    .select({
      materialId: schema.ahspComponents.materialId,
      coefficient: schema.ahspComponents.coefficient,
      matCode: schema.materials.code,
      matName: schema.materials.name,
      matType: schema.materials.type,
      matUnit: schema.materials.unit,
    })
    .from(schema.ahspComponents)
    .innerJoin(
      schema.materials,
      eq(schema.materials.id, schema.ahspComponents.materialId),
    )
    .where(eq(schema.ahspComponents.ahspItemId, ahspId));

  const priceMap = await getLatestMaterialPrices(
    comps.map((c) => c.materialId),
    null,
  );
  const enriched = comps.map((c) => {
    const price = priceMap.get(c.materialId)?.price ?? null;
    const coef = Number(c.coefficient);
    const contrib = price != null ? coef * price : 0;
    return { ...c, coef, price, contrib };
  });
  enriched.sort((a, b) => b.contrib - a.contrib);
  return enriched;
}

// Heuristik "harga material kelihatan ngaco" buat highlight kandidat fix.
function looksCorrupt(
  matType: string,
  matUnit: string,
  price: number,
): string | null {
  const u = matUnit.toLowerCase().replace(/['`]/g, "").trim();
  if (matType === "tenaga") {
    // OH (orang-hari): wajar 80rb–250rb. >2jt mencurigakan.
    if (price > 2_000_000) return `upah OH ${fmt(price)} — cek ×10/×100`;
    return null;
  }
  if (matType === "bahan") {
    if (["kg", "zak", "sak"].includes(u) && price > 1_000_000)
      return `bahan/${u} ${fmt(price)} — kandidat ×1000`;
    if (["m3"].includes(u) && price > 3_000_000)
      return `bahan/m3 ${fmt(price)} — cek (pasir/split/bata wajar <500rb)`;
    if (["m1", "m'", "m", "batang", "btg"].includes(u) && price > 2_000_000)
      return `bahan/${u} ${fmt(price)} — cek ×1000`;
    if (["bh", "buah", "unit", "lbr", "lembar"].includes(u) && price > 20_000_000)
      return `bahan/${u} ${fmt(price)} — kandidat ×1000`;
    if (price > 50_000_000) return `bahan ${fmt(price)} — outlier ekstrem`;
    return null;
  }
  if (matType === "alat") {
    if (price > 5_000_000) return `alat ${fmt(price)} — cek satuan/×1000`;
    return null;
  }
  return null;
}

async function main() {
  const onlyCode = process.argv[2]?.trim() || null;

  const items: ItemRow[] = await db
    .select({
      id: schema.ahspItems.id,
      code: schema.ahspItems.code,
      name: schema.ahspItems.name,
      unit: schema.ahspItems.unit,
    })
    .from(schema.ahspItems);

  console.log(`Total ahsp_items: ${items.length}`);

  // Hitung harga semua item (batch biar gak satu query raksasa).
  const priceById = new Map<string, { price: number; missing: string[] }>();
  const BATCH = 200;
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    const m = await computeAhspPrices(
      slice.map((it) => it.id),
      null,
    );
    for (const it of slice) {
      const r = m.get(it.id);
      priceById.set(it.id, {
        price: r ? Number(r.price) : 0,
        missing: r?.missing ?? [],
      });
    }
  }

  // Klasifikasi
  type Flag = ItemRow & {
    price: number;
    reason: string;
    missing: string[];
  };
  const absurd: Flag[] = [];
  const zero: Flag[] = [];

  for (const it of items) {
    if (onlyCode && it.code !== onlyCode) continue;
    const { price, missing } = priceById.get(it.id)!;
    const th = thresholdFor(it.unit);
    if (th && price > th.max) {
      absurd.push({
        ...it,
        price,
        missing,
        reason: `> ambang ${th.label} (${fmt(th.max)})`,
      });
    } else if (price === 0) {
      // Item harga 0 = semua komponen tanpa harga ATAU tanpa komponen sama
      // sekali. Tetap flag (banyak yang harusnya berharga).
      zero.push({ ...it, price, missing, reason: "HSP = 0" });
    }
  }

  absurd.sort((a, b) => b.price - a.price);

  console.log(`\n${"=".repeat(78)}`);
  console.log(`ABSURD (harga di atas ambang): ${absurd.length} item`);
  console.log("=".repeat(78));
  for (const it of absurd) {
    console.log(
      `\n[${it.code}] ${it.unit}  ${fmt(it.price)}  — ${it.name.slice(0, 60)}`,
    );
    const comps = await drillComponents(it.id);
    const total = comps.reduce((s, c) => s + c.contrib, 0);
    // tampilkan top-5 kontributor
    for (const c of comps.slice(0, 5)) {
      const pct = total > 0 ? (c.contrib / total) * 100 : 0;
      const corrupt = c.price != null ? looksCorrupt(c.matType, c.matUnit, c.price) : null;
      const priceStr = c.price != null ? fmt(c.price) : "(no price)";
      console.log(
        `   ${pct.toFixed(0).padStart(3)}%  koef ${c.coef
          .toString()
          .padStart(10)} × ${priceStr.padStart(16)}/${c.matUnit.padEnd(4)} = ${fmt(
          c.contrib,
        ).padStart(16)}  ${c.matType.padEnd(6)} ${c.matName.slice(0, 34)}${
          corrupt ? "  <== " + corrupt : ""
        }`,
      );
    }
    if (comps.length > 5)
      console.log(`   ... +${comps.length - 5} komponen lain`);
  }

  console.log(`\n${"=".repeat(78)}`);
  console.log(`HARGA 0 (kandidat seharusnya berharga): ${zero.length} item`);
  console.log("=".repeat(78));
  // Klasifikasi zero: no-component vs all-missing
  let noComp = 0;
  const allMissing: Flag[] = [];
  for (const it of zero) {
    const comps = await drillComponents(it.id);
    if (comps.length === 0) noComp++;
    else allMissing.push(it);
  }
  console.log(`  ${noComp} item TANPA komponen (kosong total)`);
  console.log(
    `  ${allMissing.length} item PUNYA komponen tapi semua harga material kosong:`,
  );
  for (const it of allMissing.slice(0, 40)) {
    console.log(
      `   [${it.code}] ${it.unit}  ${it.name.slice(0, 52)}  | missing: ${it.missing
        .slice(0, 3)
        .join(", ")}${it.missing.length > 3 ? " ..." : ""}`,
    );
  }
  if (allMissing.length > 40)
    console.log(`   ... +${allMissing.length - 40} lagi`);

  await db.$client.end?.();
  process.exit(0);
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
