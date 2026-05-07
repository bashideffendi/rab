import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

export type TemplateOption = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
};

export async function loadTemplates(): Promise<TemplateOption[]> {
  const rows = await db
    .select({
      id: schema.projects.id,
      slug: schema.projects.templateSlug,
      name: schema.projects.name,
      category: schema.projects.templateCategory,
      description: schema.projects.templateDescription,
    })
    .from(schema.projects)
    .where(eq(schema.projects.isTemplate, true))
    .orderBy(asc(schema.projects.templateCategory));

  return rows
    .filter((r): r is { id: string; slug: string; name: string; category: string | null; description: string | null } => r.slug !== null)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      category: r.category,
      description: r.description,
    }));
}
