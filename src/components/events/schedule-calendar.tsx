"use client";

import { Fragment, useState, useMemo, useCallback } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ScheduleConfig {
  slotDuration: number;
  dayStartHour: number;
  dayEndHour: number;
}

interface GameItem {
  id: string;
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
  round: { id: string; name: string; type: string; category: { id: string; name: string } };
  scheduledAt: Date | string | null;
  locationId: string | null;
  location: { id: string; name: string } | null;
  durationMinutes: number;
  status: string;
}

interface LocalAssignment {
  scheduledAt: string;
  locationId: string;
}

const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  slotDuration: 30,
  dayStartHour: 8,
  dayEndHour: 20,
};

export function ScheduleCalendar({ eventId }: { eventId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: event } = useQuery(
    trpc.events.getById.queryOptions({ id: eventId })
  );
  const { data: allGames, isLoading: gamesLoading } = useQuery(
    trpc.games.listByEvent.queryOptions({ eventId })
  );
  const { data: locations } = useQuery(
    trpc.locations.list.queryOptions({ eventId })
  );

  const scheduleConfig = (event?.scheduleConfig ?? DEFAULT_SCHEDULE_CONFIG) as ScheduleConfig;

  // Local state for drag-and-drop changes (gameId -> assignment)
  const [localChanges, setLocalChanges] = useState<Record<string, LocalAssignment>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Compute event days
  const eventDays = useMemo(() => {
    if (!event) return [];
    const days: Date[] = [];
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    while (current <= endDay) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [event]);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Time slots for the grid
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = scheduleConfig.dayStartHour; h < scheduleConfig.dayEndHour; h++) {
      for (let m = 0; m < 60; m += scheduleConfig.slotDuration) {
        const hour = h % 12 || 12;
        const ampm = h < 12 ? "AM" : "PM";
        const mins = m.toString().padStart(2, "0");
        slots.push(`${hour}:${mins} ${ampm}`);
      }
    }
    return slots;
  }, [scheduleConfig]);

  // Get effective game data (merging local changes)
  const getEffectiveGame = useCallback(
    (game: GameItem) => {
      const local = localChanges[game.id];
      const effectiveScheduledAt = local?.scheduledAt ?? (game.scheduledAt ? new Date(game.scheduledAt).toISOString() : null);
      const effectiveLocationId = local?.locationId ?? game.locationId;
      return {
        ...game,
        effectiveScheduledAt,
        effectiveLocationId,
      };
    },
    [localChanges]
  );

  // Unscheduled games (no scheduledAt and no local assignment)
  const unscheduledGames = useMemo(() => {
    if (!allGames) return [];
    return allGames.filter((g) => {
      const local = localChanges[g.id];
      return !local && !g.scheduledAt;
    });
  }, [allGames, localChanges]);

  // Games on the grid for the selected day
  const scheduledGamesForDay = useMemo(() => {
    if (!allGames || eventDays.length === 0) return [];
    const day = eventDays[selectedDayIndex];
    if (!day) return [];
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    return allGames
      .map(getEffectiveGame)
      .filter((g) => {
        const at = g.effectiveScheduledAt;
        if (!at) return false;
        const d = new Date(at);
        return d >= dayStart && d <= dayEnd;
      });
  }, [allGames, eventDays, selectedDayIndex, getEffectiveGame]);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || !eventDays[selectedDayIndex]) return;

    const gameId = active.id as string;
    // over.id format: "slot-{slotIndex}-{locationId}"
    const parts = (over.id as string).split("-");
    if (parts[0] !== "slot" || parts.length < 3) return;

    const slotIndex = parseInt(parts[1]);
    const locationId = parts.slice(2).join("-");

    const day = eventDays[selectedDayIndex];
    const totalMinutes =
      scheduleConfig.dayStartHour * 60 +
      slotIndex * scheduleConfig.slotDuration;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    const scheduledAt = new Date(day);
    scheduledAt.setHours(hour, minute, 0, 0);

    setLocalChanges((prev) => ({
      ...prev,
      [gameId]: {
        scheduledAt: scheduledAt.toISOString(),
        locationId,
      },
    }));
  }

  const batchUpdate = useMutation(
    trpc.games.batchUpdateSchedule.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.games.listByEvent.queryFilter({ eventId })
        );
        setLocalChanges({});
        toast.success("Schedule saved");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSave() {
    const updates = Object.entries(localChanges).map(([gameId, assignment]) => ({
      gameId,
      scheduledAt: assignment.scheduledAt,
      locationId: assignment.locationId,
    }));
    if (updates.length === 0) {
      toast.info("No changes to save");
      return;
    }
    batchUpdate.mutate({ eventId, updates });
  }

  const activeGame = allGames?.find((g) => g.id === activeDragId);
  const hasChanges = Object.keys(localChanges).length > 0;

  if (gamesLoading) {
    return <p className="text-sm text-muted-foreground">Loading schedule...</p>;
  }

  if (!locations || locations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Add courts in the Details step first before scheduling games.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!allGames || allGames.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No games generated yet. Generate games in the Rounds step first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Day tabs */}
        <div className="flex gap-2 items-center flex-wrap">
          {eventDays.map((day, i) => (
            <Button
              key={i}
              variant={selectedDayIndex === i ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDayIndex(i)}
            >
              {day.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </Button>
          ))}
          <div className="ml-auto flex gap-2">
            {hasChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocalChanges({})}
              >
                Discard Changes
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || batchUpdate.isPending}
            >
              {batchUpdate.isPending
                ? "Saving..."
                : hasChanges
                  ? `Save ${Object.keys(localChanges).length} Change(s)`
                  : "No Changes"}
            </Button>
          </div>
        </div>

        <div className="flex gap-4">
          {/* Unscheduled games sidebar */}
          <div className="w-56 shrink-0 space-y-2">
            <h3 className="text-sm font-medium">
              Unscheduled ({unscheduledGames.length})
            </h3>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {unscheduledGames.map((game) => (
                <DraggableGameCard key={game.id} game={game} />
              ))}
              {unscheduledGames.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  All games scheduled
                </p>
              )}
            </div>
          </div>

          {/* Calendar grid */}
          <div className="flex-1 overflow-x-auto">
            <div
              className="grid min-w-[400px]"
              style={{
                gridTemplateColumns: `80px repeat(${locations.length}, 1fr)`,
              }}
            >
              {/* Header row */}
              <div className="sticky top-0 bg-background border-b p-2 text-xs font-medium text-muted-foreground">
                Time
              </div>
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="sticky top-0 bg-background border-b border-l p-2 text-xs font-medium text-center"
                >
                  {loc.name}
                </div>
              ))}

              {/* Time slot rows */}
              {timeSlots.map((label, slotIndex) => (
                <Fragment key={`slot-${slotIndex}`}>
                  <div
                    className="border-b p-1 text-[11px] text-muted-foreground flex items-start pt-2"
                  >
                    {label}
                  </div>
                  {locations.map((loc) => {
                    const cellId = `slot-${slotIndex}-${loc.id}`;
                    // Find game in this cell
                    const gameInCell = scheduledGamesForDay.find((g) => {
                      if (g.effectiveLocationId !== loc.id) return false;
                      const at = new Date(g.effectiveScheduledAt!);
                      const totalMin = at.getHours() * 60 + at.getMinutes();
                      const slotMin =
                        scheduleConfig.dayStartHour * 60 +
                        slotIndex * scheduleConfig.slotDuration;
                      return totalMin === slotMin;
                    });

                    return (
                      <DroppableCell
                        key={cellId}
                        cellId={cellId}
                        hasGame={!!gameInCell}
                      >
                        {gameInCell && (
                          <DraggableGameCard game={gameInCell} compact />
                        )}
                      </DroppableCell>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeGame ? (
          <GameCardContent game={activeGame} compact={false} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DraggableGameCard({
  game,
  compact,
}: {
  game: GameItem;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: game.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(isDragging && "opacity-30")}
    >
      <GameCardContent game={game} compact={compact} />
    </div>
  );
}

function GameCardContent({
  game,
  compact,
}: {
  game: GameItem;
  compact?: boolean;
}) {
  const t1 = game.team1?.name ?? "TBD";
  const t2 = game.team2?.name ?? "TBD";

  if (compact) {
    return (
      <div className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] cursor-grab select-none truncate">
        <span className="font-medium">{t1}</span>
        <span className="text-muted-foreground"> v </span>
        <span className="font-medium">{t2}</span>
      </div>
    );
  }

  return (
    <div className="rounded border bg-card px-2 py-1.5 text-xs cursor-grab select-none shadow-sm">
      <div className="font-medium truncate">
        {t1} vs {t2}
      </div>
      <div className="text-[10px] text-muted-foreground truncate">
        {game.round.category.name} - {game.round.name}
      </div>
    </div>
  );
}

function DroppableCell({
  cellId,
  children,
  hasGame,
}: {
  cellId: string;
  children?: React.ReactNode;
  hasGame: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: cellId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-b border-l min-h-[32px] p-0.5 transition-colors",
        isOver && !hasGame && "bg-primary/10",
        isOver && hasGame && "bg-destructive/10"
      )}
    >
      {children}
    </div>
  );
}
