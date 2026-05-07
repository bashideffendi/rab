import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

// postgres.js client — single connection for serverless / dev hot-reload safe.
// In production with persistent runtime, increase `max` for connection pool.
const client = postgres(databaseUrl, {
  max: process.env.NODE_ENV === "production" ? 10 : 1,
  prepare: false,
});

export const db = drizzle(client, { schema, logger: process.env.NODE_ENV !== "production" });

export { schema };
