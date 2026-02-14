"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { TIMEZONES, DEFAULT_SCHEDULE_CONFIG, type ScheduleConfig } from "@/lib/constants";
import { type ScoringConfig, DEFAULT_SCORING_CONFIG } from "@/server/lib/scoring-validation";

type TournamentFormat = "ROUND_ROBIN" | "SINGLE_ELIM" | "DOUBLE_ELIM" | "SWISS" | "CUSTOM";

interface TournamentSettingsFormProps {
  tournament: {
    id: string;
    name: string;
    description: string | null;
    startDate: Date;
    endDate: Date;
    timezone: string;
    status: string;
    format?: TournamentFormat | null;
    drawsAllowed?: boolean | null;
    scoringConfig?: unknown;
    scheduleConfig?: unknown;
    tiebreakerConfig?: unknown;
    pointsConfig?: unknown;
  };
}

function formatDateForInput(date: Date): string {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

const TIEBREAKER_OPTIONS = [
  { value: "POINTS", label: "Standing Points" },
  { value: "WINS", label: "Wins" },
  { value: "HEAD_TO_HEAD", label: "Head-to-Head" },
  { value: "POINT_DIFFERENTIAL", label: "Point Differential" },
  { value: "POINTS_FOR", label: "Points For" },
  { value: "POINTS_AGAINST", label: "Points Against (fewer is better)" },
];

export function TournamentSettingsForm({ tournament }: TournamentSettingsFormProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isCompleted = tournament.status === "COMPLETED";

  const [timezone, setTimezone] = useState(tournament.timezone);
  const [format, setFormat] = useState<TournamentFormat>(tournament.format ?? "ROUND_ROBIN");
  const [drawsAllowed, setDrawsAllowed] = useState(tournament.drawsAllowed ?? false);

  const parsedConfig = ((tournament.scoringConfig as ScoringConfig | null) ?? DEFAULT_SCORING_CONFIG);
  const [pointsPerSet, setPointsPerSet] = useState(parsedConfig.pointsPerSet);
  const [totalSets, setTotalSets] = useState(String(parsedConfig.totalSets));
  const [deuceEnabled, setDeuceEnabled] = useState(parsedConfig.deuceEnabled);
  const [maxPoints, setMaxPoints] = useState(parsedConfig.maxPoints);

  const schedConfig = ((tournament.scheduleConfig as ScheduleConfig | null) ?? DEFAULT_SCHEDULE_CONFIG);
  const [slotDuration, setSlotDuration] = useState(String(schedConfig.slotDuration));
  const [dayStartHour, setDayStartHour] = useState(schedConfig.dayStartHour);
  const [dayEndHour, setDayEndHour] = useState(schedConfig.dayEndHour);

  const tbConfig = tournament.tiebreakerConfig as { order: string[] } | null;
  const defaultTiebreakers = tbConfig?.order ?? [
    "POINTS",
    "WINS",
    "HEAD_TO_HEAD",
    "POINT_DIFFERENTIAL",
  ];
  const [tiebreakerOrder, setTiebreakerOrder] = useState<string[]>(defaultTiebreakers);

  const updateTournament = useMutation(
    trpc.tournaments.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.tournaments.getById.queryFilter({ id: tournament.id }));
        toast.success("Tournament settings saved");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  function moveTiebreaker(index: number, direction: "up" | "down") {
    const newOrder = [...tiebreakerOrder];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    setTiebreakerOrder(newOrder);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    updateTournament.mutate({
      id: tournament.id,
      name: (formData.get("name") as string).trim(),
      description: (formData.get("description") as string) || undefined,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      timezone,
      format,
      drawsAllowed,
      scoringConfig: {
        pointsPerSet,
        totalSets: parseInt(totalSets),
        deuceEnabled,
        maxPoints,
      },
      scheduleConfig: {
        slotDuration: parseInt(slotDuration),
        dayStartHour,
        dayEndHour,
      },
      tiebreakerConfig: {
        order: tiebreakerOrder,
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="name">Tournament Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={tournament.name}
          disabled={isCompleted}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={tournament.description ?? ""}
          placeholder="Add a description for your tournament..."
          disabled={isCompleted}
        />
      </div>

      <div className="space-y-2">
        <Label>Format</Label>
        <Select value={format} onValueChange={(v) => setFormat(v as TournamentFormat)} disabled={isCompleted}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
            <SelectItem value="SINGLE_ELIM">Single Elimination</SelectItem>
            <SelectItem value="DOUBLE_ELIM">Double Elimination</SelectItem>
            <SelectItem value="SWISS">Swiss</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="drawsAllowed"
          checked={drawsAllowed}
          onCheckedChange={(checked) => setDrawsAllowed(checked === true)}
          disabled={isCompleted}
        />
        <Label htmlFor="drawsAllowed" className="text-sm font-normal">
          Allow draws in matches
        </Label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={formatDateForInput(tournament.startDate)}
            disabled={isCompleted}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={formatDateForInput(tournament.endDate)}
            disabled={isCompleted}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone} disabled={isCompleted}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Scoring Rules */}
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Scoring Rules</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pointsPerSet">Points per Set</Label>
            <Input
              id="pointsPerSet"
              type="number"
              min={1}
              max={50}
              value={pointsPerSet}
              onChange={(e) => setPointsPerSet(parseInt(e.target.value) || 21)}
              disabled={isCompleted}
            />
          </div>
          <div className="space-y-2">
            <Label>Sets to Play (Best of)</Label>
            <Select
              value={totalSets}
              onValueChange={setTotalSets}
              disabled={isCompleted}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 set</SelectItem>
                <SelectItem value="3">Best of 3</SelectItem>
                <SelectItem value="5">Best of 5</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maxPoints">Max Points (Deuce Cap)</Label>
            <Input
              id="maxPoints"
              type="number"
              min={1}
              max={50}
              value={maxPoints}
              onChange={(e) => setMaxPoints(parseInt(e.target.value) || 30)}
              disabled={isCompleted}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              id="deuceEnabled"
              checked={deuceEnabled}
              onCheckedChange={(checked) => setDeuceEnabled(checked === true)}
              disabled={isCompleted}
            />
            <Label htmlFor="deuceEnabled" className="text-sm font-normal">
              Enable deuce (2-point lead required)
            </Label>
          </div>
        </div>
      </div>

      {/* Schedule Config */}
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Schedule Settings</h3>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Time Slot Duration</Label>
            <Select
              value={slotDuration}
              onValueChange={setSlotDuration}
              disabled={isCompleted}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dayStartHour">Day Start Hour</Label>
            <Input
              id="dayStartHour"
              type="number"
              min={0}
              max={23}
              value={dayStartHour}
              onChange={(e) => setDayStartHour(parseInt(e.target.value) || 8)}
              disabled={isCompleted}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dayEndHour">Day End Hour</Label>
            <Input
              id="dayEndHour"
              type="number"
              min={1}
              max={24}
              value={dayEndHour}
              onChange={(e) => setDayEndHour(parseInt(e.target.value) || 20)}
              disabled={isCompleted}
            />
          </div>
        </div>
      </div>

      {/* Tiebreaker Config */}
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Tiebreaker Order</h3>
        <p className="text-xs text-muted-foreground">
          Drag or use arrows to reorder. Higher items take priority.
        </p>
        <div className="space-y-1">
          {tiebreakerOrder.map((tb, i) => {
            const option = TIEBREAKER_OPTIONS.find((o) => o.value === tb);
            return (
              <div
                key={tb}
                className="flex items-center justify-between rounded border px-3 py-2 text-sm"
              >
                <span>
                  <span className="text-xs text-muted-foreground mr-2">{i + 1}.</span>
                  {option?.label ?? tb}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-xs"
                    onClick={() => moveTiebreaker(i, "up")}
                    disabled={i === 0 || isCompleted}
                  >
                    ^
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-xs"
                    onClick={() => moveTiebreaker(i, "down")}
                    disabled={i === tiebreakerOrder.length - 1 || isCompleted}
                  >
                    v
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button type="submit" disabled={isCompleted || updateTournament.isPending}>
        {updateTournament.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
