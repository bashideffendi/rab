/**
 * Validator matching AHSP Stage Calculator (safety-net anti-regresi).
 *
 * Untuk tiap `ahspKeyword` di STAGE_CALCULATORS, replikasi resolusi
 * /api/ahsp/search (expandQuery → AND token / OR pola, urut nama) + filter
 * unit ala stage-calculator-modal, lalu surface zero-hit & unit-mismatch.
 *
 * Jalankan setelah ubah keyword / re-seed katalog:
 *   node --env-file=.env.local --import tsx scripts/validate-stage-ahsp.ts
 *
 * Sisa zero-hit/unit-mismatch yang "wajar" (mis. steiger tak ada di katalog,
 * papan nama punya dup ilustratif m2) di-handle picker manual + flag unit di
 * modal — bukan silent drop.
 *
 * Di-exclude dari tsconfig (dev tool, butuh DB) supaya tak ikut `next build`.
 */
import postgres from "postgres";
import { STAGE_CALCULATORS } from "../src/lib/stage-calculators";
import { expandQuery } from "../src/lib/ahsp-search";

const sql = postgres(process.env.DATABASE_URL ?? "", { prepare: false });
const esc = (s: string) => s.replace(/'/g, "''");
const norm = (u: string) => (u || "").toLowerCase().replace("'", "");

type Row = { code: string; name: string; unit: string };

async function resolve(keyword: string, unit: string) {
  const conds = expandQuery(keyword)
    .map(
      (pats) =>
        "(" +
        pats
          .map((p) => `(name ILIKE '%${esc(p)}%' OR code ILIKE '%${esc(p)}%')`)
          .join(" OR ") +
        ")",
    )
    .join(" AND ");
  const rows = (await sql.unsafe(
    `SELECT code,name,unit FROM ahsp_items WHERE ${conds} ORDER BY name LIMIT 10`,
  )) as unknown as Row[];
  const matched = rows.find((r) => norm(r.unit) === unit.toLowerCase());
  return { matched, best: matched ?? rows[0] ?? null };
}

async function main() {
  let total = 0;
  let zero = 0;
  let mis = 0;
  for (const stage of STAGE_CALCULATORS) {
    const di: Record<string, number> = {};
    for (const inp of stage.inputs) di[inp.key] = inp.default ?? 0;
    console.log("\n## " + stage.label);
    for (const it of stage.items) {
      total++;
      const kw =
        typeof it.ahspKeyword === "function"
          ? it.ahspKeyword(di)
          : it.ahspKeyword;
      const r = await resolve(kw, it.ahspUnit);
      let flag = "";
      if (!r.best) {
        zero++;
        flag = "  ZERO-HIT";
      } else if (!r.matched) {
        mis++;
        flag = `  UNIT(mau ${it.ahspUnit}, dapat ${r.best.unit})`;
      }
      const got = r.best
        ? `{${r.best.code}} [${r.best.unit}] ${r.best.name.slice(0, 46)}`
        : "NONE";
      console.log(`  ${it.key} "${kw}" [${it.ahspUnit}] -> ${got}${flag}`);
    }
  }
  console.log(
    `\n=== ${total} sub-item | ${zero} zero-hit | ${mis} unit-mismatch`,
  );
  await sql.end();
}

main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  process.exit(1);
});
