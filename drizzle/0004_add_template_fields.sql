ALTER TABLE "projects" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "template_category" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "template_description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "template_slug" text;--> statement-breakpoint
CREATE INDEX "projects_template_idx" ON "projects" USING btree ("is_template");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_template_slug_idx" ON "projects" USING btree ("template_slug");