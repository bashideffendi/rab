import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/db";

/**
 * Seed 3 template proyek umum buat user awam.
 * Idempotent: skip kalau slug udah ada.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-templates.ts
 */

type TemplateItem = {
  ahspCode: string; // resolve ke AHSP yang udah di-seed
  volume: string;
};

type TemplateWbs = {
  code: string;
  name: string;
  items: TemplateItem[];
};

type Template = {
  slug: string;
  name: string;
  category: "rumah" | "renovasi" | "komersial";
  description: string;
  notes?: string;
  wbs: TemplateWbs[];
};

const TEMPLATES: Template[] = [
  {
    slug: "renovasi-dapur-sederhana",
    name: "Renovasi Dapur Sederhana 3x3m",
    category: "renovasi",
    description:
      "Renovasi dapur 9 m² (3×3): pembersihan, pasangan batu sloof, plesteran 2 sisi.",
    notes:
      "Asumsi luas dapur 9 m², tinggi 2.7 m, dinding 4 sisi (24 m² plesteran).",
    wbs: [
      {
        code: "1",
        name: "Pekerjaan Persiapan",
        items: [{ ahspCode: "A.4.2.1.1", volume: "9" }], // pembersihan 9 m2
      },
      {
        code: "2",
        name: "Pekerjaan Pasangan",
        items: [{ ahspCode: "A.4.1.1.10", volume: "1.5" }], // pasangan batu kali 1.5 m3
      },
      {
        code: "3",
        name: "Pekerjaan Plesteran",
        items: [{ ahspCode: "A.4.1.1.30", volume: "24" }], // plesteran 24 m2
      },
    ],
  },
  {
    slug: "rumah-sederhana-36m2",
    name: "Bangun Rumah Sederhana 36 m² (1 lantai)",
    category: "rumah",
    description:
      "Bangun rumah subsidi/sederhana 36 m² 1 lantai: persiapan, struktur dasar, dinding plester.",
    notes:
      "Estimasi kasar — luas bangunan 36 m², lahan ~80 m², pondasi batu kali, struktur sloof+kolom beton, dinding plesteran 2 sisi.",
    wbs: [
      {
        code: "1",
        name: "Pekerjaan Persiapan",
        items: [
          { ahspCode: "A.4.2.1.1", volume: "80" }, // pembersihan
          { ahspCode: "A.4.1.1.1", volume: "12" }, // galian pondasi
          { ahspCode: "A.4.1.1.5", volume: "6" }, // urugan kembali
        ],
      },
      {
        code: "2",
        name: "Pekerjaan Struktur",
        items: [
          { ahspCode: "A.4.1.1.10", volume: "8" }, // pasangan batu kali pondasi
          { ahspCode: "A.4.1.1.20", volume: "4" }, // beton K-225 sloof+kolom
        ],
      },
      {
        code: "3",
        name: "Pekerjaan Dinding & Finish",
        items: [
          { ahspCode: "A.4.1.1.30", volume: "180" }, // plesteran 2 sisi
        ],
      },
    ],
  },
  {
    slug: "pagar-50m-tinggi-2m",
    name: "Bangun Pagar 50m, Tinggi 2m",
    category: "komersial",
    description:
      "Pagar pasangan batu kali tinggi 2m, panjang 50m: pondasi, dinding, plester 2 sisi.",
    notes:
      "Pondasi kontinu sepanjang pagar, dinding pasangan batu kali, plesteran 2 sisi (200 m²).",
    wbs: [
      {
        code: "1",
        name: "Pekerjaan Persiapan",
        items: [
          { ahspCode: "A.4.2.1.1", volume: "50" }, // pembersihan
          { ahspCode: "A.4.1.1.1", volume: "10" }, // galian pondasi
        ],
      },
      {
        code: "2",
        name: "Pekerjaan Pondasi",
        items: [{ ahspCode: "A.4.1.1.10", volume: "12.5" }], // pasangan batu kali
      },
      {
        code: "3",
        name: "Pekerjaan Plesteran",
        items: [{ ahspCode: "A.4.1.1.30", volume: "200" }], // plester 2 sisi
      },
    ],
  },
];

async function main() {
  // Build map: AHSP code → AHSP id (untuk resolve template items)
  const ahspRows = await db
    .select({ id: schema.ahspItems.id, code: schema.ahspItems.code })
    .from(schema.ahspItems);
  const ahspIdByCode = new Map<string, string>();
  for (const r of ahspRows) ahspIdByCode.set(r.code, r.id);

  let created = 0;
  let skipped = 0;

  for (const t of TEMPLATES) {
    // Skip kalau slug udah ada
    const existing = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.isTemplate, true),
          eq(schema.projects.templateSlug, t.slug),
        ),
      )
      .limit(1);

    if (existing[0]) {
      skipped++;
      console.log(`   - ${t.slug}: skip (already exists)`);
      continue;
    }

    // Insert template project (user_id NULL, is_template true)
    const [proj] = await db
      .insert(schema.projects)
      .values({
        userId: null,
        name: t.name,
        status: "active",
        notes: t.notes ?? null,
        isTemplate: true,
        templateCategory: t.category,
        templateDescription: t.description,
        templateSlug: t.slug,
      })
      .returning({ id: schema.projects.id });

    // Insert WBS, capture id by code
    const wbsIdByCode = new Map<string, string>();
    let sortOrder = 0;
    for (const w of t.wbs) {
      const [wbsRow] = await db
        .insert(schema.wbsItems)
        .values({
          projectId: proj.id,
          parentId: null,
          code: w.code,
          name: w.name,
          level: 0,
          sortOrder: sortOrder++,
        })
        .returning({ id: schema.wbsItems.id });
      wbsIdByCode.set(w.code, wbsRow.id);
    }

    // Insert items per WBS
    let itemSortOrder = 0;
    for (const w of t.wbs) {
      const wbsId = wbsIdByCode.get(w.code)!;
      for (const it of w.items) {
        const ahspId = ahspIdByCode.get(it.ahspCode);
        if (!ahspId) {
          console.log(
            `   ⚠ AHSP ${it.ahspCode} gak ditemukan di db (skip item).`,
          );
          continue;
        }
        await db.insert(schema.projectItems).values({
          projectId: proj.id,
          wbsItemId: wbsId,
          ahspItemId: ahspId,
          customName: null, // recalc on clone
          customUnit: null,
          customUnitPrice: null,
          volume: it.volume,
          sortOrder: itemSortOrder++,
        });
      }
    }

    created++;
    console.log(`   ✓ ${t.slug}: ${t.wbs.length} WBS + items`);
  }

  console.log("");
  console.log(`✓ Templates seeded — created ${created}, skipped ${skipped}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
