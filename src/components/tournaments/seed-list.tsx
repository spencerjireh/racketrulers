"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  name: string;
  seed: number;
}

interface SeedListProps {
  participants: Participant[];
  onReorder: (participantIds: string[]) => void;
  disabled?: boolean;
}

function SortableItem({
  participant,
  index,
  disabled,
}: {
  participant: Participant;
  index: number;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: participant.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded border px-2 py-1.5 text-sm bg-card",
        isDragging && "opacity-50 shadow-lg z-10",
        disabled && "opacity-60"
      )}
    >
      <button
        type="button"
        className={cn(
          "touch-none text-muted-foreground shrink-0",
          !disabled && "cursor-grab active:cursor-grabbing hover:text-foreground"
        )}
        {...attributes}
        {...listeners}
        disabled={disabled}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted-foreground tabular-nums w-5 text-right shrink-0">
        {index + 1}
      </span>
      <span className="truncate">{participant.name}</span>
    </div>
  );
}

export function SeedList({ participants, onReorder, disabled }: SeedListProps) {
  const [items, setItems] = useState(participants);

  // Sync when participants change from outside (e.g. after mutation settles)
  if (participants.length !== items.length || participants.some((p, i) => p.id !== items[i]?.id)) {
    setItems(participants);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);
    onReorder(newItems.map((p) => p.id));
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Seed Order
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((participant, index) => (
            <SortableItem
              key={participant.id}
              participant={participant}
              index={index}
              disabled={disabled}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
