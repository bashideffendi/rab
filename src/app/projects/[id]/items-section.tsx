import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ItemAddForm } from "./item-add-form";
import { ItemDeleteButton } from "./item-delete-button";
import { formatIDR } from "@/lib/utils";

type ItemRow = {
  id: string;
  wbsCode: string | null;
  wbsName: string | null;
  name: string;
  unit: string;
  volume: string;
  unitPrice: string;
  ahspCode: string | null;
  ahspSourceDoc: string | null;
  ahspSourceModule: string | null;
  ahspSourceSection: string | null;
};

type WbsOption = {
  id: string;
  code: string;
  name: string;
};

export type AhspOption = {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string;
};

async function loadItems(projectId: string): Promise<ItemRow[]> {
  const rows = await db
    .select({
      id: schema.projectItems.id,
      wbsCode: schema.wbsItems.code,
      wbsName: schema.wbsItems.name,
      customName: schema.projectItems.customName,
      customUnit: schema.projectItems.customUnit,
      volume: schema.projectItems.volume,
      customUnitPrice: schema.projectItems.customUnitPrice,
      ahspCode: schema.ahspItems.code,
      ahspSourceDoc: schema.ahspItems.sourceDoc,
      ahspSourceModule: schema.ahspItems.sourceModule,
      ahspSourceSection: schema.ahspItems.sourceSection,
    })
    .from(schema.projectItems)
    .leftJoin(
      schema.wbsItems,
      eq(schema.wbsItems.id, schema.projectItems.wbsItemId),
    )
    .leftJoin(
      schema.ahspItems,
      eq(schema.ahspItems.id, schema.projectItems.ahspItemId),
    )
    .where(eq(schema.projectItems.projectId, projectId))
    .orderBy(asc(schema.projectItems.sortOrder));

  return rows.map((r) => ({
    id: r.id,
    wbsCode: r.wbsCode,
    wbsName: r.wbsName,
    name: r.customName ?? "(custom item)",
    unit: r.customUnit ?? "",
    volume: r.volume,
    unitPrice: r.customUnitPrice ?? "0",
    ahspCode: r.ahspCode,
    ahspSourceDoc: r.ahspSourceDoc,
    ahspSourceModule: r.ahspSourceModule,
    ahspSourceSection: r.ahspSourceSection,
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

async function loadAhspOptions(): Promise<AhspOption[]> {
  return db
    .select({
      id: schema.ahspItems.id,
      code: schema.ahspItems.code,
      name: schema.ahspItems.name,
      unit: schema.ahspItems.unit,
      category: schema.ahspItems.category,
    })
    .from(schema.ahspItems)
    .orderBy(asc(schema.ahspItems.code));
}

function calcTotal(volume: string, unitPrice: string): number {
  const v = Number(volume);
  const p = Number(unitPrice);
  if (!Number.isFinite(v) || !Number.isFinite(p)) return 0;
  return v * p;
}

function sortByCode(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const ap = a.split(".").map(Number);
  const bp = b.split(".").map(Number);
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

type Group = {
  wbsCode: string | null;
  wbsName: string | null;
  items: ItemRow[];
  subtotal: number;
};

function groupByWbs(items: ItemRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const key = it.wbsCode ?? "__no_wbs__";
    let g = map.get(key);
    if (!g) {
      g = {
        wbsCode: it.wbsCode,
        wbsName: it.wbsName,
        items: [],
        subtotal: 0,
      };
      map.set(key, g);
    }
    g.items.push(it);
    g.subtotal += calcTotal(it.volume, it.unitPrice);
  }
  return Array.from(map.values()).sort((a, b) =>
    sortByCode(a.wbsCode, b.wbsCode),
  );
}

export async function ItemsSection({ projectId }: { projectId: string }) {
  let items: ItemRow[] = [];
  let wbsOptions: WbsOption[] = [];
  let ahspOptions: AhspOption[] = [];
  let dbError: string | null = null;
  try {
    [items, wbsOptions, ahspOptions] = await Promise.all([
      loadItems(projectId),
      loadWbsOptions(projectId),
      loadAhspOptions(),
    ]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Gagal load items.";
  }

  const groups = groupByWbs(items);
  const grandTotal = groups.reduce((sum, g) => sum + g.subtotal, 0);

  return (
    <section className="mt-12">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">
            Item RAB
          </p>
          <h2 className="text-lg font-semibold tracking-tight">
            Daftar pekerjaan
          </h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-muted-foreground">
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
            <thead className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Pekerjaan</th>
                <th className="px-3 py-2 text-right font-medium">Volume</th>
                <th className="px-3 py-2 font-medium">Sat</th>
                <th className="px-3 py-2 text-right font-medium">Harga Sat</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows
                  key={g.wbsCode ?? "no-wbs"}
                  group={g}
                  projectId={projectId}
                />
              ))}
            </tbody>
            <tfoot className="bg-muted/40">
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-3 text-right text-sm font-medium text-muted-foreground"
                >
                  Grand Total
                </td>
                <td className="px-3 py-3 text-right font-mono text-base font-semibold tabular-nums text-accent">
                  {formatIDR(grandTotal)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ItemAddForm
        projectId={projectId}
        wbsOptions={wbsOptions}
        ahspOptions={ahspOptions}
      />
    </section>
  );
}

function GroupRows({
  group,
  projectId,
}: {
  group: Group;
  projectId: string;
}) {
  const headerLabel =
    group.wbsCode === null
      ? "Tanpa WBS"
      : `${group.wbsCode} — ${group.wbsName ?? ""}`;

  return (
    <>
      <tr className="border-t-2 border-border bg-muted/30">
        <td colSpan={5} className="px-3 py-2">
          <span className="text-xs font-semibold text-accent">
            {headerLabel}
          </span>
          <span className="ml-3 font-mono text-[10px] text-muted-foreground tabular-nums">
            {group.items.length} item
          </span>
        </td>
        <td></td>
      </tr>
      {group.items.map((it) => {
        const total = calcTotal(it.volume, it.unitPrice);
        return (
          <tr
            key={it.id}
            className="border-t border-border hover:bg-muted/20"
          >
            <td className="px-3 py-2">
              <div>{it.name}</div>
              {it.ahspCode && (
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="rounded border border-accent/40 bg-accent/5 px-1.5 py-0.5 text-accent">
                    AHSP
                  </span>
                  <span>{it.ahspCode}</span>
                  {it.ahspSourceDoc && (
                    <span title={it.ahspSourceDoc}>
                      · {it.ahspSourceModule ?? it.ahspSourceDoc}
                    </span>
                  )}
                </div>
              )}
            </td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">
              {Number(it.volume).toLocaleString("id-ID")}
            </td>
            <td className="px-3 py-2 text-muted-foreground">{it.unit}</td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">
              {formatIDR(it.unitPrice)}
            </td>
            <td className="px-3 py-2 text-right font-mono font-medium tabular-nums">
              {formatIDR(total)}
            </td>
            <td className="px-3 py-2 text-right">
              <div className="flex items-center justify-end gap-1">
                <Link
                  href={`/projects/${projectId}/items/${it.id}/edit`}
                  className="rounded border border-transparent px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
                  aria-label={`Edit ${it.name}`}
                >
                  edit
                </Link>
                <ItemDeleteButton
                  id={it.id}
                  projectId={projectId}
                  name={it.name}
                />
              </div>
            </td>
          </tr>
        );
      })}
      <tr className="border-t border-border bg-muted/10">
        <td
          colSpan={4}
          className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground"
        >
          Subtotal {group.wbsCode ?? "tanpa WBS"}
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-xs font-medium tabular-nums">
          {formatIDR(group.subtotal)}
        </td>
        <td></td>
      </tr>
    </>
  );
}
