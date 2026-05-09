ALTER TABLE "project_items" ADD COLUMN "calculator_type" text;
--> statement-breakpoint
ALTER TABLE "project_items" ADD COLUMN "calculator_inputs" jsonb;
--> statement-breakpoint
ALTER TABLE "project_items" ADD COLUMN "volume_formula" text;
