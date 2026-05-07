import { isNull } from "drizzle-orm";
import { db, schema } from "../src/db";

/**
 * Cleanup project lama yang user_id NULL (test data dari sebelum auth).
 * Run sekali aja sebelum auth go-live.
 */
async function main() {
  const result = await db
    .delete(schema.projects)
    .where(isNull(schema.projects.userId))
    .returning({ id: schema.projects.id, name: schema.projects.name });

  console.log(`Deleted ${result.length} orphan projects:`);
  for (const r of result) console.log(` - ${r.id} ${r.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
