ALTER TABLE "projects" ADD COLUMN "cover_image_url" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" uuid,
  "action" text NOT NULL,
  "summary" text,
  "details" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_audit_log_project_idx" ON "project_audit_log" ("project_id", "created_at");
