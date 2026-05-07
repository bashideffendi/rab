import { loadTemplates } from "@/lib/queries/templates";
import { cloneTemplate } from "./template-actions";
import { Button } from "@/components/ui/button";

const CATEGORY_LABELS: Record<string, string> = {
  rumah: "Bangun Rumah",
  renovasi: "Renovasi",
  komersial: "Komersial",
};

export async function TemplatesGallery() {
  let templates: Awaited<ReturnType<typeof loadTemplates>> = [];
  try {
    templates = await loadTemplates();
  } catch {
    return null;
  }

  if (templates.length === 0) return null;

  return (
    <section className="mb-8">
      <header className="mb-4">
        <p className="text-sm font-semibold text-accent">
          Template Siap Pakai
        </p>
        <h2 className="text-lg font-semibold tracking-tight">
          Mulai cepat dari template
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pilih template yang mirip proyek-mu — WBS &amp; item RAB udah siap,
          tinggal sesuaikan volume/harga.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="flex flex-col rounded border border-border bg-muted/20 p-4 transition-colors hover:border-accent/40"
          >
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-accent">
                {(t.category && CATEGORY_LABELS[t.category]) ??
                  t.category ??
                  "Umum"}
              </span>
            </div>
            <h3 className="mb-2 font-semibold tracking-tight">{t.name}</h3>
            <p className="mb-4 flex-1 text-xs leading-relaxed text-muted-foreground">
              {t.description ?? "Template proyek standar."}
            </p>
            <form action={cloneTemplate}>
              <input type="hidden" name="slug" value={t.slug} />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="w-full"
              >
                Pakai Template →
              </Button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
