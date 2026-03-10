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
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DEFAULT_SCHEDULE_CONFIG, type ScheduleConfig } from "@/lib/constants";

interface MatchItem {
  id: string;
  participant1: { id: string; name: string } | null;
  participant2: { id: string; name: string } | null;
  round: number | null;
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

export function ScheduleCalendar({ tournamentId }: { tournamentId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: tournament } = useQuery(
    trpc.tournaments.getById.queryOptions({ id: tournamentId })
  );
  const { data: allMatches, isLoading: matchesLoading } = useQuery(
    trpc.matches.listByTournament.queryOptions({ tournamentId })
  );
  const { data: locations } = useQuery(
    trpc.locations.list.queryOptions({ tournamentId })
  );

  const scheduleConfig = (tournament?.scheduleConfig ?? DEFAULT_SCHEDULE_CONFIG) as ScheduleConfig;

  // Local state for drag-and-drop changes (matchId -> assignment)
  const [localChanges, setLocalChanges] = useState<Record<string, LocalAssignment>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Compute tournament days
  const tournamentDays = useMemo(() => {
    if (!tournament) return [];
    const days: Date[] = [];
    const start = new Date(tournament.startDate);
    const end = new Date(tournament.endDate);
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    while (current <= endDay) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [tournament]);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Get effective match data (merging local changes)
  const getEffectiveMatch = useCallback(
    (match: MatchItem) => {
      const local = localChanges[match.id];
      const effectiveScheduledAt = local?.scheduledAt ?? (match.scheduledAt ? new Date(match.scheduledAt).toISOString() : null);
      const effectiveLocationId = local?.locationId ?? match.locationId;
      return {
        ...match,
        effectiveScheduledAt,
        effectiveLocationId,
      };
    },
    [localChanges]
  );

  // Pre-compute match lookup by cell key for O(1) access per cell
  const matchByCellKey = useMemo(() => {
    if (!allMatches || tournamentDays.length === 0) return new Map<string, ReturnType<typeof getEffectiveMatch>>();
    const day = tournamentDays[selectedDayIndex];
    if (!day) return new Map<string, ReturnType<typeof getEffectiveMatch>>();

    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const map = new Map<string, ReturnType<typeof getEffectiveMatch>>();
    for (const match of allMatches) {
      const m = getEffectiveMatch(match as unknown as MatchItem);
      if (!m.effectiveScheduledAt || !m.effectiveLocationId) continue;
      const d = new Date(m.effectiveScheduledAt);
      if (d < dayStart || d > dayEnd) continue;
      const totalMin = d.getHours() * 60 + d.getMinutes();
      const slotIndex = Math.floor(
        (totalMin - scheduleConfig.dayStartHour * 60) / scheduleConfig.slotDuration
      );
      const key = `${m.effectiveLocationId}-${slotIndex}`;
      map.set(key, m);
    }
    return map;
  }, [allMatches, tournamentDays, selectedDayIndex, getEffectiveMatch, scheduleConfig]);

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

  // Unscheduled matches (no scheduledAt and no local assignment)
  const unscheduledMatches = useMemo(() => {
    if (!allMatches) return [];
    return allMatches.filter((m) => {
      const local = localChanges[m.id];
      return !local && !m.scheduledAt;
    });
  }, [allMatches, localChanges]);

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
    if (!over || !tournamentDays[selectedDayIndex]) return;

    const matchId = active.id as string;
    // over.id format: "slot-{slotIndex}-{locationId}"
    const parts = (over.id as string).split("-");
    if (parts[0] !== "slot" || parts.length < 3) return;

    const slotIndex = parseInt(parts[1]);
    const locationId = parts.slice(2).join("-");

    const day = tournamentDays[selectedDayIndex];
    const totalMinutes =
      scheduleConfig.dayStartHour * 60 +
      slotIndex * scheduleConfig.slotDuration;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    const scheduledAt = new Date(day);
    scheduledAt.setHours(hour, minute, 0, 0);

    setLocalChanges((prev) => ({
      ...prev,
      [matchId]: {
        scheduledAt: scheduledAt.toISOString(),
        locationId,
      },
    }));
  }

  const batchUpdate = useMutation(
    trpc.matches.batchUpdateSchedule.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.matches.listByTournament.queryFilter({ tournamentId })
        );
        setLocalChanges({});
        toast.success("Schedule saved");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSave() {
    const updates = Object.entries(localChanges).map(([matchId, assignment]) => ({
      matchId,
      scheduledAt: assignment.scheduledAt,
      locationId: assignment.locationId,
    }));
    if (updates.length === 0) {
      toast.info("No changes to save");
      return;
    }
    batchUpdate.mutate({ tournamentId, updates });
  }

  const activeMatch = allMatches?.find((m) => m.id === activeDragId);
  const hasChanges = Object.keys(localChanges).length > 0;

  if (matchesLoading) {
    return <LoadingState text="Loading schedule..." />;
  }

  if (!locations || locations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Add courts in the Settings tab first before scheduling matches.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!allMatches || allMatches.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No matches generated yet. Start the tournament to generate matches.
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
          {tournamentDays.map((day, i) => (
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
          {/* Unscheduled matches sidebar */}
          <div className="w-56 shrink-0 space-y-2">
            <h3 className="text-sm font-medium">
              Unscheduled ({unscheduledMatches.length})
            </h3>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {(unscheduledMatches as unknown as MatchItem[]).map((match) => (
                <DraggableMatchCard key={match.id} match={match} />
              ))}
              {unscheduledMatches.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  All matches scheduled
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
                    const matchInCell = matchByCellKey.get(`${loc.id}-${slotIndex}`);

                    return (
                      <DroppableCell
                        key={cellId}
                        cellId={cellId}
                        hasMatch={!!matchInCell}
                      >
                        {matchInCell && (
                          <DraggableMatchCard match={matchInCell} compact />
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
        {activeMatch ? (
          <MatchCardContent match={activeMatch as unknown as MatchItem} compact={false} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DraggableMatchCard({
  match,
  compact,
}: {
  match: MatchItem;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: match.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(isDragging && "opacity-30")}
    >
      <MatchCardContent match={match} compact={compact} />
    </div>
  );
}

function MatchCardContent({
  match,
  compact,
}: {
  match: MatchItem;
  compact?: boolean;
}) {
  const p1 = match.participant1?.name ?? "TBD";
  const p2 = match.participant2?.name ?? "TBD";

  if (compact) {
    return (
      <div className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] cursor-grab select-none truncate">
        <span className="font-medium">{p1}</span>
        <span className="text-muted-foreground"> v </span>
        <span className="font-medium">{p2}</span>
      </div>
    );
  }

  return (
    <div className="rounded border bg-card px-2 py-1.5 text-xs cursor-grab select-none shadow-sm">
      <div className="font-medium truncate">
        {p1} vs {p2}
      </div>
      {match.round !== null && (
        <div className="text-[10px] text-muted-foreground truncate">
          Round {match.round}
        </div>
      )}
    </div>
  );
}

function DroppableCell({
  cellId,
  children,
  hasMatch,
}: {
  cellId: string;
  children?: React.ReactNode;
  hasMatch: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: cellId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-b border-l min-h-[32px] p-0.5 transition-colors",
        isOver && !hasMatch && "bg-primary/10",
        isOver && hasMatch && "bg-destructive/10"
      )}
    >
      {children}
    </div>
  );
}
