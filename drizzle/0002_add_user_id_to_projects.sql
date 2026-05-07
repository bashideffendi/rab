ALTER TABLE "projects" ADD COLUMN "user_id" uuid;--> statement-breakpoint
CREATE INDEX "projects_user_idx" ON "projects" USING btree ("user_id");