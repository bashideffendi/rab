import { and, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { expandQuery } from "@/lib/ahsp-search";

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
        versionName: schema.ahspVersions.name,
        versionCurrent: schema.ahspVersions.isCurrent,
      })
      .from(schema.ahspItems)
      .leftJoin(
        schema.ahspVersions,
        eq(schema.ahspItems.versionId, schema.ahspVersions.id),
      )
      .orderBy(schema.ahspItems.code)
      .limit(limit);
    return Response.json(rows);
  }

  // Tokenisasi + alias (K-225 → f'c 19,3 dst, sinonim BOW/SNI). Tiap token
  // WAJIB cocok (AND); tiap token boleh lewat salah satu alias-nya (OR antar
  // nama/kode). Ini benerin (a) query multi-kata yang dulu butuh substring
  // kontigu, dan (b) mutu beton kolokial yang gak ada di data f'c MPa.
  const tokenClauses = expandQuery(query)
    .map((patterns) =>
      or(
        ...patterns.flatMap((p) => {
          const like = `%${p}%`;
          return [
            ilike(schema.ahspItems.name, like),
            ilike(schema.ahspItems.code, like),
          ];
        }),
      ),
    )
    .filter((c): c is SQL => c != null);

  const whereClause =
    tokenClauses.length === 0
      ? ilike(schema.ahspItems.name, `%${query}%`)
      : tokenClauses.length === 1
        ? tokenClauses[0]
        : and(...tokenClauses);

  // Sort: exact code > code-prefix > name match
  const rows = await db
    .select({
      id: schema.ahspItems.id,
      code: schema.ahspItems.code,
      name: schema.ahspItems.name,
      unit: schema.ahspItems.unit,
      category: schema.ahspItems.category,
      sourceDoc: schema.ahspItems.sourceDoc,
      versionName: schema.ahspVersions.name,
      versionCurrent: schema.ahspVersions.isCurrent,
    })
    .from(schema.ahspItems)
    .leftJoin(
      schema.ahspVersions,
      eq(schema.ahspItems.versionId, schema.ahspVersions.id),
    )
    .where(whereClause)
    .orderBy(
      // (1) Bongkaran/demolisi turun (kecuali user memang cari 'bongkar')
      sql`CASE WHEN (${schema.ahspItems.code} ILIKE 'AT.%'
                 OR ${schema.ahspItems.name} ~* '(bongkar|pembongkaran)')
               AND ${query} !~* 'bongkar' THEN 1 ELSE 0 END`,
      // (2) Varian premium/khusus/industri turun (biar default = varian standar,
      //     bukan termahal: keramik→bukan artistik, pipa→bukan header industri)
      sql`CASE WHEN ${schema.ahspItems.name} ~* '(artistik|siklop|dekoratif|import|marmer|expose|ekspos|header|silent type|stainless)'
               THEN 1 ELSE 0 END`,
      // (3) Rank kode (exact > prefix > lainnya) — logika lama dipertahankan
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
