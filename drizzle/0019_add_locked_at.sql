ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "locked_at" timestamptz;
