"use client";

import { useEffect, useState, useTransition } from "react";
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
import { WbsRow } from "./wbs-row";
import { reorderWbsItems } from "@/app/projects/wbs-reorder-actions";

export type WbsListItem = {
  id: string;
  code: string;
  name: string;
  level: number;
  notes: string | null;
};

export function WbsList({
  projectId,
  initialItems,
}: {
  projectId: string;
  initialItems: WbsListItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Sync kalau parent revalidate dan kasih items baru (mis. setelah add WBS)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

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
    const previous = items;
    setItems(reordered);
    setError(null);
    startTransition(async () => {
      const result = await reorderWbsItems(
        projectId,
        reordered.map((i) => i.id),
      );
      if (result.error) {
        setItems(previous);
        setError(result.error);
      }
    });
  }

  return (
    <>
      {error && (
        <div className="mb-2 rounded-md border border-danger/40 bg-danger/5 px-3 py-1.5 text-xs text-danger">
          {error}
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="mb-4 overflow-hidden rounded border border-border">
            {items.map((it) => (
              <SortableWbsRow
                key={it.id}
                projectId={projectId}
                item={it}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </>
  );
}

function SortableWbsRow({
  projectId,
  item,
}: {
  projectId: string;
  item: WbsListItem;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <WbsRow
      id={item.id}
      code={item.code}
      name={item.name}
      level={item.level}
      projectId={projectId}
      notes={item.notes}
      sortable={{
        setNodeRef,
        attributes,
        listeners,
        style: {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.4 : 1,
        },
      }}
    />
  );
}
