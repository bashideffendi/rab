-- Add progress_period to projects. 'weekly' (default) | 'daily'.
-- Existing rows backfilled ke 'weekly' supaya backward-compat.
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "progress_period" text NOT NULL DEFAULT 'weekly';

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_progress_period_check"
  CHECK ("progress_period" IN ('weekly', 'daily'));
