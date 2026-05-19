"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ItemDeleteButton } from "./item-delete-button";
import { formatIDR } from "@/lib/utils";
import { reorderItemsInGroup } from "@/app/projects/item-reorder-actions";

export type ItemRow = {
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
  volumeFormula: string | null;
  notes: string | null;
};

export type ItemGroup = {
  wbsCode: string | null;
  wbsName: string | null;
  items: ItemRow[];
  subtotal: number;
};

function calcTotal(volume: string, unitPrice: string): number {
  const v = Number(volume);
  const p = Number(unitPrice);
  if (!Number.isFinite(v) || !Number.isFinite(p)) return 0;
  return v * p;
}

export function ItemsTableBody({
  projectId,
  groups,
}: {
  projectId: string;
  groups: ItemGroup[];
}) {
  return (
    <>
      {groups.map((g, gi) => (
        <SortableGroup
          key={g.wbsCode ?? `__no_wbs_${gi}`}
          projectId={projectId}
          group={g}
        />
      ))}
    </>
  );
}

function SortableGroup({
  projectId,
  group,
}: {
  projectId: string;
  group: ItemGroup;
}) {
  const [items, setItems] = useState(group.items);
  const [, startTransition] = useTransition();
  const [reorderError, setReorderError] = useState<string | null>(null);

  // Sync state kalau parent props berubah (mis. after revalidate)
  // Pakai dependency on group.items reference. State akan reset.
  // (React 19: useState lazy init dengan default function gak re-run on
  //  parent re-render. Cara simpel: useEffect comparing items vs group.items.)
  // Untuk MVP, kita relying ke revalidatePath yang re-mount component.

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered); // optimistic
    setReorderError(null);
    startTransition(async () => {
      const result = await reorderItemsInGroup(
        projectId,
        reordered.map((i) => i.id),
      );
      if (result.error) {
        // Rollback on error
        setItems(items);
        setReorderError(result.error);
      }
    });
  }

  const headerLabel =
    group.wbsCode === null
      ? "Tanpa WBS"
      : `${group.wbsCode} — ${group.wbsName ?? ""}`;

  return (
    <>
      <tr className="border-t-2 border-accent/30 bg-accent/10">
        <td colSpan={6} className="px-3 py-2.5">
          <span className="text-sm font-bold text-accent">{headerLabel}</span>
          <span className="ml-3 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
            {items.length} item
          </span>
          {reorderError && (
            <span className="ml-3 rounded-md border border-danger/40 bg-danger/5 px-2 py-0.5 text-xs text-danger">
              {reorderError}
            </span>
          )}
        </td>
      </tr>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((it) => (
            <SortableItemRow
              key={it.id}
              projectId={projectId}
              item={it}
            />
          ))}
        </SortableContext>
      </DndContext>
      <tr className="border-t border-border bg-muted/30">
        <td
          colSpan={4}
          className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground"
        >
          Subtotal {group.wbsCode ?? "tanpa WBS"}
        </td>
        <td className="px-3 py-2 text-right font-mono text-sm font-bold tabular-nums text-foreground">
          {formatIDR(group.subtotal)}
        </td>
        <td className="w-20"></td>
      </tr>
    </>
  );
}

function SortableItemRow({
  projectId,
  item,
}: {
  projectId: string;
  item: ItemRow;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? "var(--muted)" : undefined,
  };

  const total = calcTotal(item.volume, item.unitPrice);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-t border-border hover:bg-muted/20"
    >
      <td className="px-3 py-2">
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <button
            type="button"
            aria-label={`Drag ${item.name}`}
            className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="5" cy="3" r="1.2" />
              <circle cx="9" cy="3" r="1.2" />
              <circle cx="5" cy="7" r="1.2" />
              <circle cx="9" cy="7" r="1.2" />
              <circle cx="5" cy="11" r="1.2" />
              <circle cx="9" cy="11" r="1.2" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="flex items-start gap-1.5">
              <span>{item.name}</span>
              {item.notes && (
                <span
                  className="mt-0.5 cursor-help text-xs leading-none text-accent"
                  title={item.notes}
                  aria-label={`Catatan: ${item.notes}`}
                >
                  📝
                </span>
              )}
            </div>
            {item.ahspCode && (
              <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                <span className="rounded border border-accent/40 bg-accent/5 px-1.5 py-0.5 text-accent">
                  AHSP
                </span>
                <span>{item.ahspCode}</span>
                {item.ahspSourceDoc && (
                  <span title={item.ahspSourceDoc}>
                    · {item.ahspSourceModule ?? item.ahspSourceDoc}
                  </span>
                )}
              </div>
            )}
            {item.notes && (
              <div className="mt-0.5 text-[11px] italic text-muted-foreground line-clamp-2">
                {item.notes}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        <div className="flex flex-col items-end">
          <span>{Number(item.volume).toLocaleString("id-ID")}</span>
          {item.volumeFormula && (
            <span
              className="cursor-help text-[10px] font-normal text-muted-foreground"
              title={`Rumus: ${item.volumeFormula}`}
            >
              📐 {item.volumeFormula.split("=")[0]?.trim() ?? "Calculator"}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{item.unit}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {formatIDR(item.unitPrice)}
      </td>
      <td className="px-3 py-2 text-right font-mono font-medium tabular-nums">
        {formatIDR(total)}
      </td>
      <td className="w-20 px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/projects/${projectId}/items/${item.id}/edit`}
            className="rounded border border-transparent px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
            aria-label={`Edit ${item.name}`}
          >
            edit
          </Link>
          <ItemDeleteButton
            id={item.id}
            projectId={projectId}
            name={item.name}
          />
        </div>
      </td>
    </tr>
  );
}
