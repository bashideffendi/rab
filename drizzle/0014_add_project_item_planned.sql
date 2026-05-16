CREATE TABLE IF NOT EXISTS "project_item_planned" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_item_id" uuid NOT NULL REFERENCES "project_items"("id") ON DELETE CASCADE,
  "week_num" integer NOT NULL,
  "percent_planned" numeric(5, 2) NOT NULL DEFAULT '0.00',
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_item_planned_item_idx" ON "project_item_planned" ("project_item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_item_planned_unique_idx" ON "project_item_planned" ("project_item_id", "week_num");
