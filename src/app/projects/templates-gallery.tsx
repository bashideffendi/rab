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
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Template Siap Pakai
        </p>
        <h2 className="mt-1 text-lg font-bold tracking-tight">
          Mulai dengan Template
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Pilih template yang sesuai jenis proyek — WBS dan item RAB sudah
          tersedia, tinggal sesuaikan volume dan harga.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="flex flex-col rounded-md border border-border bg-card p-4 shadow-sm transition-colors hover:border-accent/40"
          >
            <div className="mb-3 flex items-baseline justify-between">
              <span className="rounded border border-accent/40 bg-accent/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
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
                Gunakan Template →
              </Button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
