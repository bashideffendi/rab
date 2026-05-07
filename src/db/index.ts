import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

function init(): DrizzleDb | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const client = postgres(url, {
    max: process.env.NODE_ENV === "production" ? 10 : 1,
    prepare: false,
  });
  return drizzle(client, {
    schema,
    logger: process.env.NODE_ENV !== "production",
  });
}

let cached: DrizzleDb | null | undefined;

function getDb(): DrizzleDb {
  if (cached === undefined) cached = init();
  if (!cached) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example ke .env.local dan isi.",
    );
  }
  return cached;
}

// Lazy proxy: import sukses meski DATABASE_URL belum ada;
// throw cuma waktu method dipanggil (jadi try/catch di page work).
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
}) as DrizzleDb;

export { schema };
