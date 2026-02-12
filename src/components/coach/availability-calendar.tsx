"use client";

import { Fragment, useState, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const START_HOUR = 6;
const END_HOUR = 22;
const SLOT_MINUTES = 30;
const TOTAL_ROWS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;

interface Slot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Block {
  id: string;
  dayOfWeek: number;
  startRow: number;
  rowSpan: number;
  startTime: string;
  endTime: string;
}

interface AvailabilityCalendarProps {
  slots: Slot[];
  onChange: (slots: Slot[]) => void;
}

function timeToRow(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h - START_HOUR) * 60 + m) / SLOT_MINUTES;
}

function rowToTime(row: number): string {
  const totalMinutes = START_HOUR * 60 + row * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function slotsToBlocks(slots: Slot[]): Block[] {
  // Group by dayOfWeek, sort by startTime, merge adjacent
  const byDay = new Map<number, Slot[]>();
  for (const s of slots) {
    const arr = byDay.get(s.dayOfWeek) ?? [];
    arr.push(s);
    byDay.set(s.dayOfWeek, arr);
  }

  const blocks: Block[] = [];
  let idCounter = 0;

  for (const [day, daySlots] of byDay) {
    const sorted = [...daySlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    let current: { startTime: string; endTime: string } | null = null;

    for (const slot of sorted) {
      if (current && slot.startTime <= current.endTime) {
        // Merge overlapping/adjacent
        if (slot.endTime > current.endTime) {
          current.endTime = slot.endTime;
        }
      } else {
        if (current) {
          const startRow = timeToRow(current.startTime);
          const endRow = timeToRow(current.endTime);
          blocks.push({
            id: `block-${idCounter++}`,
            dayOfWeek: day,
            startRow,
            rowSpan: endRow - startRow,
            startTime: current.startTime,
            endTime: current.endTime,
          });
        }
        current = { startTime: slot.startTime, endTime: slot.endTime };
      }
    }
    if (current) {
      const startRow = timeToRow(current.startTime);
      const endRow = timeToRow(current.endTime);
      blocks.push({
        id: `block-${idCounter++}`,
        dayOfWeek: day,
        startRow,
        rowSpan: endRow - startRow,
        startTime: current.startTime,
        endTime: current.endTime,
      });
    }
  }

  return blocks;
}

function blocksToSlots(blocks: Block[]): Slot[] {
  return blocks.map((b) => ({
    dayOfWeek: b.dayOfWeek,
    startTime: b.startTime,
    endTime: b.endTime,
  }));
}

export function AvailabilityCalendar({ slots, onChange }: AvailabilityCalendarProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => slotsToBlocks(slots));
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [idCounter, setIdCounter] = useState(1000);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const syncBlocks = useCallback(
    (newBlocks: Block[]) => {
      setBlocks(newBlocks);
      onChange(blocksToSlots(newBlocks));
    },
    [onChange]
  );

  function handleCellClick(dayOfWeek: number, row: number) {
    // Check if cell is inside an existing block
    const existing = blocks.find(
      (b) => b.dayOfWeek === dayOfWeek && row >= b.startRow && row < b.startRow + b.rowSpan
    );
    if (existing) {
      setSelectedBlockId(existing.id === selectedBlockId ? null : existing.id);
      return;
    }

    // Create a 1-hour block (2 rows)
    const rowSpan = Math.min(2, TOTAL_ROWS - row);
    const newBlock: Block = {
      id: `block-${idCounter}`,
      dayOfWeek,
      startRow: row,
      rowSpan,
      startTime: rowToTime(row),
      endTime: rowToTime(row + rowSpan),
    };
    setIdCounter((c) => c + 1);
    setSelectedBlockId(null);
    syncBlocks([...blocks, newBlock]);
  }

  function handleDeleteBlock(blockId: string) {
    setSelectedBlockId(null);
    syncBlocks(blocks.filter((b) => b.id !== blockId));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const blockId = active.id as string;
    const parts = (over.id as string).split("-");
    if (parts[0] !== "cell") return;

    const targetDay = parseInt(parts[1]);
    const targetRow = parseInt(parts[2]);

    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    // Ensure block doesn't go past grid bounds
    const maxRow = TOTAL_ROWS - block.rowSpan;
    const clampedRow = Math.min(targetRow, maxRow);
    if (clampedRow < 0) return;

    const newBlocks = blocks.map((b) =>
      b.id === blockId
        ? {
            ...b,
            dayOfWeek: targetDay,
            startRow: clampedRow,
            startTime: rowToTime(clampedRow),
            endTime: rowToTime(clampedRow + b.rowSpan),
          }
        : b
    );
    syncBlocks(newBlocks);
  }

  // Build time labels
  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < TOTAL_ROWS; i++) {
      labels.push(formatTime(rowToTime(i)));
    }
    return labels;
  }, []);

  // Build a lookup: day -> row -> block
  const blockLookup = useMemo(() => {
    const lookup = new Map<string, Block>();
    for (const b of blocks) {
      for (let r = b.startRow; r < b.startRow + b.rowSpan; r++) {
        lookup.set(`${b.dayOfWeek}-${r}`, b);
      }
    }
    return lookup;
  }, [blocks]);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[600px]"
          style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}
        >
          {/* Header row */}
          <div className="border-b p-1 text-xs font-medium text-muted-foreground" />
          {DAYS.map((day) => (
            <div
              key={day}
              className="border-b border-l p-1 text-xs font-medium text-center"
            >
              {day}
            </div>
          ))}

          {/* Time rows */}
          {timeLabels.map((label, rowIndex) => (
            <Fragment key={`row-${rowIndex}`}>
              <div className="border-b p-1 text-[10px] text-muted-foreground flex items-start pt-1.5 justify-end pr-2">
                {rowIndex % 2 === 0 ? label : ""}
              </div>
              {DAYS.map((_, dayIndex) => {
                const block = blockLookup.get(`${dayIndex}-${rowIndex}`);
                const isBlockStart = block && block.startRow === rowIndex;

                return (
                  <TimeCell
                    key={`cell-${dayIndex}-${rowIndex}`}
                    cellId={`cell-${dayIndex}-${rowIndex}`}
                    onClick={() => handleCellClick(dayIndex, rowIndex)}
                    hasBlock={!!block}
                  >
                    {isBlockStart && (
                      <AvailabilityBlock
                        block={block}
                        isSelected={selectedBlockId === block.id}
                        onSelect={() => setSelectedBlockId(selectedBlockId === block.id ? null : block.id)}
                        onDelete={() => handleDeleteBlock(block.id)}
                      />
                    )}
                  </TimeCell>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <DragOverlay>
        {/* Minimal overlay during drag */}
      </DragOverlay>
    </DndContext>
  );
}

function AvailabilityBlock({
  block,
  isSelected,
  onSelect,
  onDelete,
}: {
  block: Block;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
  });

  const heightPx = block.rowSpan * 24; // ~24px per row

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "absolute left-0.5 right-0.5 rounded-sm bg-primary/20 border border-primary/40 cursor-grab select-none z-10 flex items-start justify-between px-1 overflow-hidden",
        isDragging && "opacity-30",
        isSelected && "ring-2 ring-primary"
      )}
      style={{ height: `${heightPx}px`, top: 0 }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <span className="text-[10px] text-primary font-medium truncate pt-0.5">
        {formatTime(block.startTime)} - {formatTime(block.endTime)}
      </span>
      {isSelected && (
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 shrink-0 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function TimeCell({
  cellId,
  children,
  onClick,
  hasBlock,
}: {
  cellId: string;
  children?: React.ReactNode;
  onClick: () => void;
  hasBlock: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: cellId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-b border-l min-h-[24px] relative transition-colors cursor-pointer",
        isOver && !hasBlock && "bg-primary/10",
        !hasBlock && "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
