ALTER TABLE "projects" ADD COLUMN "tahun" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "alamat" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "ppn_percent" numeric(5, 2) DEFAULT '11.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "overhead_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "dibulatkan_ke" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "projects_archived_idx" ON "projects" USING btree ("is_archived");