import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL tidak di-set.");
  process.exit(1);
}

const migrationsDir = join(process.cwd(), "drizzle");
const filesToApply = [
  "0013_add_project_started_at.sql",
  "0014_add_project_item_planned.sql",
];

const sql = postgres(databaseUrl, { max: 1 });

async function main() {
  for (const file of filesToApply) {
    const path = join(migrationsDir, file);
    const content = readFileSync(path, "utf8");
    const statements = content
      .split(/-->\s*statement-breakpoint/)
      .map((s) => s.trim())
      .filter(Boolean);
    console.log(`\n→ Apply ${file} (${statements.length} statement)`);
    for (const stmt of statements) {
      try {
        await sql.unsafe(stmt);
        console.log(`  ok: ${stmt.slice(0, 80).replace(/\s+/g, " ")}…`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Skip kalau sudah ada (idempotent for additive changes)
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate column")
        ) {
          console.log(`  skip (sudah ada): ${stmt.slice(0, 80).replace(/\s+/g, " ")}…`);
          continue;
        }
        throw e;
      }
    }
  }
  console.log("\n✓ Migration 0013 & 0014 applied.");
  await sql.end();
}

main().catch((e) => {
  console.error("Migration gagal:", e);
  process.exit(1);
});
