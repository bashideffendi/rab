DROP INDEX "ahsp_items_code_idx";--> statement-breakpoint
CREATE INDEX "ahsp_items_code_idx" ON "ahsp_items" USING btree ("code");