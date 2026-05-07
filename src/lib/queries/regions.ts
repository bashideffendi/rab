import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

export type RegionOption = {
  id: string;
  code: string;
  name: string;
  level: "nasional" | "provinsi" | "kabupaten_kota";
  ikk: string | null;
};

/**
 * Load semua provinsi (level = provinsi) untuk dropdown region picker.
 * Stage A: cuma provinsi. Stage B nanti tambah kab/kota hierarchical.
 */
export async function loadProvinsiOptions(): Promise<RegionOption[]> {
  return db
    .select({
      id: schema.regions.id,
      code: schema.regions.code,
      name: schema.regions.name,
      level: schema.regions.level,
      ikk: schema.regions.ikk,
    })
    .from(schema.regions)
    .where(eq(schema.regions.level, "provinsi"))
    .orderBy(asc(schema.regions.name));
}
