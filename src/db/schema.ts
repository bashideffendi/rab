import { relations } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
  integer,
  numeric,
  timestamp,
  date,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const projectStatus = pgEnum("project_status", [
  "draft",
  "active",
  "archived",
]);

export const ahspCategory = pgEnum("ahsp_category", [
  "bina_marga", // jalan, jembatan
  "sda", // sumber daya air, irigasi
  "cipta_karya", // gedung, sanitasi
  "permukiman",
  "umum", // generic / cross-domain
]);

export const materialType = pgEnum("material_type", [
  "tenaga", // upah (mandor, tukang, pekerja)
  "bahan", // material fisik
  "alat", // peralatan
]);

export const regionLevel = pgEnum("region_level", [
  "nasional",
  "provinsi",
  "kabupaten_kota",
]);

// ─────────────────────────────────────────────────────────────────────────────
// REGIONS — administrative tree (BPS code)
// ─────────────────────────────────────────────────────────────────────────────

export const regions = pgTable(
  "regions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(), // BPS code (e.g., "21" Kepri, "2171" Batam)
    name: text("name").notNull(),
    level: regionLevel("level").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => regions.id, {
      onDelete: "set null",
    }),
    // Indeks Kemahalan Konstruksi (IKK) — multiplier konstruksi vs nasional.
    // Nasional ≈ 100. NULL berarti belum ada data → fallback ke 1 (= nasional).
    ikk: numeric("ikk", { precision: 7, scale: 2 }),
    ikkYear: integer("ikk_year"),
    ikkSource: text("ikk_source"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("regions_code_idx").on(t.code)],
);

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Supabase auth.users.id. Nullable buat backward compat + buat templates
    // (templates = is_template true, user_id NULL).
    userId: uuid("user_id"),
    name: text("name").notNull(),
    opd: text("opd"),
    ownerName: text("owner_name"),
    regionId: uuid("region_id").references(() => regions.id, {
      onDelete: "set null",
    }),
    status: projectStatus("status").notNull().default("draft"),
    notes: text("notes"),
    // Phase 1 — RAB calc + project metadata expansion (rabestimator parity)
    tahun: integer("tahun"),
    alamat: text("alamat"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    projectType: text("project_type"),
    luasTanah: numeric("luas_tanah", { precision: 12, scale: 2 }),
    luasBangunan: numeric("luas_bangunan", { precision: 12, scale: 2 }),
    coverImageUrl: text("cover_image_url"),
    ppnPercent: numeric("ppn_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("11.00"),
    overheadPercent: numeric("overhead_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("0.00"),
    dibulatkanKe: integer("dibulatkan_ke").notNull().default(1000),
    isArchived: boolean("is_archived").notNull().default(false),
    // Template fields: kalau is_template = true, project ini gak pernah keliatan
    // di list user. Cuma muncul di gallery /projects untuk di-clone.
    isTemplate: boolean("is_template").notNull().default(false),
    templateCategory: text("template_category"), // "rumah", "renovasi", "komersial", dll
    templateDescription: text("template_description"),
    templateSlug: text("template_slug"), // unique slug for stable URL
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("projects_status_idx").on(t.status),
    index("projects_user_idx").on(t.userId),
    index("projects_template_idx").on(t.isTemplate),
    index("projects_archived_idx").on(t.isArchived),
    uniqueIndex("projects_template_slug_idx").on(t.templateSlug),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// WBS — Work Breakdown Structure (tree per project)
// ─────────────────────────────────────────────────────────────────────────────

export const wbsItems = pgTable(
  "wbs_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => wbsItems.id, {
      onDelete: "cascade",
    }),
    code: text("code").notNull(), // "1", "1.1", "1.1.2"
    name: text("name").notNull(),
    level: integer("level").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("wbs_items_project_idx").on(t.projectId),
    uniqueIndex("wbs_items_project_code_idx").on(t.projectId, t.code),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// AHSP REFERENCE — items + components + materials
// ─────────────────────────────────────────────────────────────────────────────

export const ahspItems = pgTable(
  "ahsp_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(), // "A.4.1.1.1"
    name: text("name").notNull(),
    category: ahspCategory("category").notNull(),
    unit: text("unit").notNull(), // "m3", "m2", "kg"
    sourceDoc: text("source_doc"), // "Permen PUPR No. 1/2022"
    sourceModule: text("source_module"), // "Modul 4 Cipta Karya"
    sourceSection: text("source_section"), // pasal/lampiran specifier
    sourceUrl: text("source_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Code BUKAN unique — kode AHSP (mis. "1.1.1.1") bisa muncul di banyak
    // sumber (Permen PUPR, SE DJBK, SNI, edisi tahun beda) — semua valid.
    index("ahsp_items_code_idx").on(t.code),
    index("ahsp_items_category_idx").on(t.category),
  ],
);

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: materialType("type").notNull(),
    unit: text("unit").notNull(), // "OH", "m3", "kg", "jam"
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("materials_code_idx").on(t.code),
    index("materials_type_idx").on(t.type),
  ],
);

export const ahspComponents = pgTable(
  "ahsp_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ahspItemId: uuid("ahsp_item_id")
      .notNull()
      .references(() => ahspItems.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "restrict" }),
    coefficient: numeric("coefficient", { precision: 18, scale: 6 }).notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("ahsp_components_item_idx").on(t.ahspItemId),
    uniqueIndex("ahsp_components_unique_idx").on(t.ahspItemId, t.materialId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// MATERIAL PRICES — temporal, regional
// ─────────────────────────────────────────────────────────────────────────────

export const materialPrices = pgTable(
  "material_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    regionId: uuid("region_id").references(() => regions.id, {
      onDelete: "cascade",
    }), // NULL = nasional default
    price: numeric("price", { precision: 18, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("IDR"),
    source: text("source"), // "HSPK Kab Batam 2025", "e-katalog LKPP", "BPS"
    sourceUrl: text("source_url"),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("material_prices_material_idx").on(t.materialId),
    index("material_prices_region_idx").on(t.regionId),
    index("material_prices_valid_idx").on(t.validFrom, t.validTo),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT ITEMS — line item dalam RAB
// ─────────────────────────────────────────────────────────────────────────────

export const projectItems = pgTable(
  "project_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    wbsItemId: uuid("wbs_item_id").references(() => wbsItems.id, {
      onDelete: "set null",
    }),
    ahspItemId: uuid("ahsp_item_id").references(() => ahspItems.id, {
      onDelete: "set null",
    }),
    customName: text("custom_name"), // kalau ahspItemId NULL — custom item
    customUnit: text("custom_unit"),
    customUnitPrice: numeric("custom_unit_price", {
      precision: 18,
      scale: 2,
    }), // nullable — kalau pake AHSP, price dihitung dari komponen × harga
    volume: numeric("volume", { precision: 18, scale: 4 }).notNull(),
    // Time Schedule fields (Phase 5)
    startWeek: integer("start_week"), // 1-based, NULL = belum di-schedule
    durationWeeks: integer("duration_weeks"), // jumlah minggu pengerjaan
    regionOverrideId: uuid("region_override_id").references(() => regions.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("project_items_project_idx").on(t.projectId),
    index("project_items_wbs_idx").on(t.wbsItemId),
    index("project_items_ahsp_idx").on(t.ahspItemId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT ITEM PROGRESS — Phase 6 progres tracking per minggu
// ─────────────────────────────────────────────────────────────────────────────

export const projectItemProgress = pgTable(
  "project_item_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectItemId: uuid("project_item_id")
      .notNull()
      .references(() => projectItems.id, { onDelete: "cascade" }),
    weekNum: integer("week_num").notNull(),
    percentActual: numeric("percent_actual", { precision: 5, scale: 2 })
      .notNull()
      .default("0.00"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("project_item_progress_item_idx").on(t.projectItemId),
    uniqueIndex("project_item_progress_unique_idx").on(
      t.projectItemId,
      t.weekNum,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT AUDIT LOG — riwayat perubahan
// ─────────────────────────────────────────────────────────────────────────────

export const projectAuditLog = pgTable(
  "project_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    action: text("action").notNull(),
    summary: text("summary"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("project_audit_log_project_idx").on(t.projectId, t.createdAt),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS — for Drizzle's relational query builder
// ─────────────────────────────────────────────────────────────────────────────

export const regionsRelations = relations(regions, ({ one, many }) => ({
  parent: one(regions, {
    fields: [regions.parentId],
    references: [regions.id],
    relationName: "regionParent",
  }),
  children: many(regions, { relationName: "regionParent" }),
  projects: many(projects),
  prices: many(materialPrices),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  region: one(regions, {
    fields: [projects.regionId],
    references: [regions.id],
  }),
  wbsItems: many(wbsItems),
  items: many(projectItems),
}));

export const wbsItemsRelations = relations(wbsItems, ({ one, many }) => ({
  project: one(projects, {
    fields: [wbsItems.projectId],
    references: [projects.id],
  }),
  parent: one(wbsItems, {
    fields: [wbsItems.parentId],
    references: [wbsItems.id],
    relationName: "wbsParent",
  }),
  children: many(wbsItems, { relationName: "wbsParent" }),
  items: many(projectItems),
}));

export const ahspItemsRelations = relations(ahspItems, ({ many }) => ({
  components: many(ahspComponents),
  projectItems: many(projectItems),
}));

export const materialsRelations = relations(materials, ({ many }) => ({
  components: many(ahspComponents),
  prices: many(materialPrices),
}));

export const ahspComponentsRelations = relations(ahspComponents, ({ one }) => ({
  ahspItem: one(ahspItems, {
    fields: [ahspComponents.ahspItemId],
    references: [ahspItems.id],
  }),
  material: one(materials, {
    fields: [ahspComponents.materialId],
    references: [materials.id],
  }),
}));

export const materialPricesRelations = relations(materialPrices, ({ one }) => ({
  material: one(materials, {
    fields: [materialPrices.materialId],
    references: [materials.id],
  }),
  region: one(regions, {
    fields: [materialPrices.regionId],
    references: [regions.id],
  }),
}));

export const projectItemsRelations = relations(projectItems, ({ one }) => ({
  project: one(projects, {
    fields: [projectItems.projectId],
    references: [projects.id],
  }),
  wbsItem: one(wbsItems, {
    fields: [projectItems.wbsItemId],
    references: [wbsItems.id],
  }),
  ahspItem: one(ahspItems, {
    fields: [projectItems.ahspItemId],
    references: [ahspItems.id],
  }),
  regionOverride: one(regions, {
    fields: [projectItems.regionOverrideId],
    references: [regions.id],
  }),
}));

