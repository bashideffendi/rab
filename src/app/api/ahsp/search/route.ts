import { ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Search AHSP catalog — fuzzy match by name + code.
 * GET /api/ahsp/search?q=beton&limit=30
 *
 * Returns top N matching AHSP items. Order: exact code match first,
 * code prefix match, name match. Designed untuk searchable combobox.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Login dulu." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const limitParam = Number(url.searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, 100)
    : 30;

  // Empty query: return first N alphabetical (browse mode)
  if (!query) {
    const rows = await db
      .select({
        id: schema.ahspItems.id,
        code: schema.ahspItems.code,
        name: schema.ahspItems.name,
        unit: schema.ahspItems.unit,
        category: schema.ahspItems.category,
        sourceDoc: schema.ahspItems.sourceDoc,
      })
      .from(schema.ahspItems)
      .orderBy(schema.ahspItems.code)
      .limit(limit);
    return Response.json(rows);
  }

  // Match by name OR code (case-insensitive). Sort: exact code > code-prefix > name match
  const pattern = `%${query}%`;
  const rows = await db
    .select({
      id: schema.ahspItems.id,
      code: schema.ahspItems.code,
      name: schema.ahspItems.name,
      unit: schema.ahspItems.unit,
      category: schema.ahspItems.category,
      sourceDoc: schema.ahspItems.sourceDoc,
    })
    .from(schema.ahspItems)
    .where(
      or(
        ilike(schema.ahspItems.name, pattern),
        ilike(schema.ahspItems.code, pattern),
      ),
    )
    .orderBy(
      // Custom rank: exact code = 0, code prefix = 1, name match = 2
      sql`CASE
        WHEN LOWER(${schema.ahspItems.code}) = LOWER(${query}) THEN 0
        WHEN LOWER(${schema.ahspItems.code}) LIKE LOWER(${query + "%"}) THEN 1
        ELSE 2
      END`,
      schema.ahspItems.name,
    )
    .limit(limit);

  return Response.json(rows);
}
