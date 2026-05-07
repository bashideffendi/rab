CREATE TYPE "public"."ahsp_category" AS ENUM('bina_marga', 'sda', 'cipta_karya', 'permukiman', 'umum');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('tenaga', 'bahan', 'alat');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."region_level" AS ENUM('nasional', 'provinsi', 'kabupaten_kota');--> statement-breakpoint
CREATE TABLE "ahsp_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ahsp_item_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"coefficient" numeric(18, 6) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ahsp_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "ahsp_category" NOT NULL,
	"unit" text NOT NULL,
	"source_doc" text,
	"source_module" text,
	"source_section" text,
	"source_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"region_id" uuid,
	"price" numeric(18, 2) NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"source" text,
	"source_url" text,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "material_type" NOT NULL,
	"unit" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"wbs_item_id" uuid,
	"ahsp_item_id" uuid,
	"custom_name" text,
	"custom_unit" text,
	"volume" numeric(18, 4) NOT NULL,
	"region_override_id" uuid,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"opd" text,
	"owner_name" text,
	"region_id" uuid,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"level" "region_level" NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wbs_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ahsp_components" ADD CONSTRAINT "ahsp_components_ahsp_item_id_ahsp_items_id_fk" FOREIGN KEY ("ahsp_item_id") REFERENCES "public"."ahsp_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ahsp_components" ADD CONSTRAINT "ahsp_components_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_prices" ADD CONSTRAINT "material_prices_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_prices" ADD CONSTRAINT "material_prices_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_wbs_item_id_wbs_items_id_fk" FOREIGN KEY ("wbs_item_id") REFERENCES "public"."wbs_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_ahsp_item_id_ahsp_items_id_fk" FOREIGN KEY ("ahsp_item_id") REFERENCES "public"."ahsp_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_region_override_id_regions_id_fk" FOREIGN KEY ("region_override_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_id_regions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wbs_items" ADD CONSTRAINT "wbs_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wbs_items" ADD CONSTRAINT "wbs_items_parent_id_wbs_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."wbs_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ahsp_components_item_idx" ON "ahsp_components" USING btree ("ahsp_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ahsp_components_unique_idx" ON "ahsp_components" USING btree ("ahsp_item_id","material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ahsp_items_code_idx" ON "ahsp_items" USING btree ("code");--> statement-breakpoint
CREATE INDEX "ahsp_items_category_idx" ON "ahsp_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "material_prices_material_idx" ON "material_prices" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "material_prices_region_idx" ON "material_prices" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "material_prices_valid_idx" ON "material_prices" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE UNIQUE INDEX "materials_code_idx" ON "materials" USING btree ("code");--> statement-breakpoint
CREATE INDEX "materials_type_idx" ON "materials" USING btree ("type");--> statement-breakpoint
CREATE INDEX "project_items_project_idx" ON "project_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_items_wbs_idx" ON "project_items" USING btree ("wbs_item_id");--> statement-breakpoint
CREATE INDEX "project_items_ahsp_idx" ON "project_items" USING btree ("ahsp_item_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_code_idx" ON "regions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "wbs_items_project_idx" ON "wbs_items" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wbs_items_project_code_idx" ON "wbs_items" USING btree ("project_id","code");