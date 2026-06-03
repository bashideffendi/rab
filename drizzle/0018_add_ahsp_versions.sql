-- ahsp_versions: edisi regulasi AHSP (swappable, queryable, badge-able)
CREATE TABLE IF NOT EXISTS "ahsp_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"issuing_body" text,
	"document_number" text,
	"effective_from" date,
	"effective_to" date,
	"document_url" text,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ahsp_versions_code_idx" ON "ahsp_versions" ("code");

ALTER TABLE "ahsp_items" ADD COLUMN IF NOT EXISTS "version_id" uuid REFERENCES "ahsp_versions"("id") ON DELETE SET NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "ahsp_version_id" uuid REFERENCES "ahsp_versions"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "ahsp_items_version_idx" ON "ahsp_items" ("version_id");

-- Seed edisi yang dikenal (current = SE 47/2026, terbit 13 Feb 2026)
INSERT INTO "ahsp_versions" ("code","name","issuing_body","document_number","effective_from","effective_to","document_url","is_current") VALUES
	('SE-47-2026','SE DJBK 47/2026','Ditjen Bina Konstruksi, Kementerian PU','47/SE/Dk/2026','2026-02-13',NULL,'https://binakonstruksi.pu.go.id/produk/produk-hukum/surat-edaran-direktur-jenderal-bina-konstruksi-nomor-47-se-dk-2026/',true),
	('SE-30-2025','SE DJBK 30/2025','Ditjen Bina Konstruksi, Kementerian PU','30/SE/Dk/2025','2025-01-01','2026-02-13',NULL,false),
	('ILUSTRATIF','Ilustratif (dev seed)',NULL,NULL,NULL,NULL,NULL,false)
ON CONFLICT ("code") DO NOTHING;

-- Backfill item AHSP → versi berdasarkan source_doc (typo 47/2025 & double-space ikut 47/2026)
UPDATE "ahsp_items" SET "version_id" = (SELECT id FROM "ahsp_versions" WHERE code='SE-47-2026')
	WHERE "version_id" IS NULL AND ("source_doc" ILIKE '%47/2026%' OR "source_doc" ILIKE '%47/2025%');
UPDATE "ahsp_items" SET "version_id" = (SELECT id FROM "ahsp_versions" WHERE code='SE-30-2025')
	WHERE "version_id" IS NULL AND "source_doc" ILIKE '%30/2025%';
UPDATE "ahsp_items" SET "version_id" = (SELECT id FROM "ahsp_versions" WHERE code='ILUSTRATIF')
	WHERE "version_id" IS NULL AND "source_doc" ILIKE '%illustrative%';

-- Backfill project: default ikut versi current
UPDATE "projects" SET "ahsp_version_id" = (SELECT id FROM "ahsp_versions" WHERE is_current = true LIMIT 1)
	WHERE "ahsp_version_id" IS NULL;
