import { defineConfig } from "drizzle-kit";

// Load .env.local manually — drizzle-kit by default cuma baca .env.
// process.loadEnvFile native Node 20.12+ (we use 20.18+).
try {
  process.loadEnvFile(".env.local");
} catch {
  // file gak ada, fallback ke process.env existing
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and set it.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
