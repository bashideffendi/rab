import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ItemAddForm } from "./item-add-form";
import { ItemDeleteButton } from "./item-delete-button";
import { formatIDR } from "@/lib/utils";

type ItemRow = {
  id: string;
  wbsCode: string | null;
  name: string;
  unit: string;
  volume: string;
  unitPrice: string;
};

type WbsOption = {
  id: string;
  code: string;
  name: string;
};

async function loadItems(projectId: string): Promise<ItemRow[]> {
  const rows = await db
    .select({
      id: schema.projectItems.id,
      wbsCode: schema.wbsItems.code,
      customName: schema.projectItems.customName,
      customUnit: schema.projectItems.customUnit,
      volume: schema.projectItems.volume,
      customUnitPrice: schema.projectItems.customUnitPrice,
    })
    .from(schema.projectItems)
    .leftJoin(
      schema.wbsItems,
      eq(schema.wbsItems.id, schema.projectItems.wbsItemId),
    )
    .where(eq(schema.projectItems.projectId, projectId))
    .orderBy(asc(schema.projectItems.sortOrder));

  return rows.map((r) => ({
    id: r.id,
    wbsCode: r.wbsCode,
    name: r.customName ?? "(custom item)",
    unit: r.customUnit ?? "",
    volume: r.volume,
    unitPrice: r.customUnitPrice ?? "0",
  }));
}

async function loadWbsOptions(projectId: string): Promise<WbsOption[]> {
  return db
    .select({
      id: schema.wbsItems.id,
      code: schema.wbsItems.code,
      name: schema.wbsItems.name,
    })
    .from(schema.wbsItems)
    .where(eq(schema.wbsItems.projectId, projectId))
    .orderBy(asc(schema.wbsItems.code));
}

function calcTotal(volume: string, unitPrice: string): number {
  const v = Number(volume);
  const p = Number(unitPrice);
  if (!Number.isFinite(v) || !Number.isFinite(p)) return 0;
  return v * p;
}

export async function ItemsSection({ projectId }: { projectId: string }) {
  let items: ItemRow[] = [];
  let wbsOptions: WbsOption[] = [];
  let dbError: string | null = null;
  try {
    [items, wbsOptions] = await Promise.all([
      loadItems(projectId),
      loadWbsOptions(projectId),
    ]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Gagal load items.";
  }

  const grandTotal = items.reduce(
    (sum, it) => sum + calcTotal(it.volume, it.unitPrice),
    0,
  );

  return (
    <section className="mt-12">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            Item RAB
          </p>
          <h2 className="text-lg font-semibold tracking-tight">
            Daftar pekerjaan
          </h2>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Total
          </p>
          <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {formatIDR(grandTotal)}
          </p>
        </div>
      </header>

      {dbError ? (
        <div className="mb-4 rounded border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
          {dbError}
        </div>
      ) : items.length === 0 ? (
        <p className="mb-4 rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada item. Tambahkan pekerjaan pertama di bawah.
        </p>
      ) : (
        <div className="mb-4 overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">WBS</th>
                <th className="px-3 py-2 font-medium">Pekerjaan</th>
                <th className="px-3 py-2 text-right font-medium">Volume</th>
                <th className="px-3 py-2 font-medium">Sat</th>
                <th className="px-3 py-2 text-right font-medium">Harga Sat</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const total = calcTotal(it.volume, it.unitPrice);
                return (
                  <tr
                    key={it.id}
                    className="border-t border-border hover:bg-muted/20"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground tabular-nums">
                      {it.wbsCode ?? "—"}
                    </td>
                    <td className="px-3 py-2">{it.name}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {Number(it.volume).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {it.unit}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatIDR(it.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium tabular-nums">
                      {formatIDR(total)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ItemDeleteButton
                        id={it.id}
                        projectId={projectId}
                        name={it.name}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/40">
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-2 text-right font-mono text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-accent">
                  {formatIDR(grandTotal)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ItemAddForm projectId={projectId} wbsOptions={wbsOptions} />
    </section>
  );
}
