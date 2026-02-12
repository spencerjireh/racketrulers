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

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Manila",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

interface ScoringConfig {
  pointsPerSet: number;
  totalSets: number;
  deuceEnabled: boolean;
  maxPoints: number;
}

const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  pointsPerSet: 21,
  totalSets: 3,
  deuceEnabled: true,
  maxPoints: 30,
};

interface ScheduleConfig {
  slotDuration: number;
  dayStartHour: number;
  dayEndHour: number;
}

const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  slotDuration: 30,
  dayStartHour: 8,
  dayEndHour: 20,
};

interface EventSettingsFormProps {
  event: {
    id: string;
    name: string;
    description: string | null;
    startDate: Date;
    endDate: Date;
    timezone: string;
    status: "DRAFT" | "PUBLISHED" | "COMPLETED";
    scoringConfig?: ScoringConfig;
    scheduleConfig?: ScheduleConfig;
  };
}

function formatDateForInput(date: Date): string {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

export function EventSettingsForm({ event }: EventSettingsFormProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isCompleted = event.status === "COMPLETED";

  const [timezone, setTimezone] = useState(event.timezone);

  const parsedConfig = (event.scoringConfig ?? DEFAULT_SCORING_CONFIG) as ScoringConfig;
  const [pointsPerSet, setPointsPerSet] = useState(parsedConfig.pointsPerSet);
  const [totalSets, setTotalSets] = useState(String(parsedConfig.totalSets));
  const [deuceEnabled, setDeuceEnabled] = useState(parsedConfig.deuceEnabled);
  const [maxPoints, setMaxPoints] = useState(parsedConfig.maxPoints);

  const schedConfig = (event.scheduleConfig ?? DEFAULT_SCHEDULE_CONFIG) as ScheduleConfig;
  const [slotDuration, setSlotDuration] = useState(String(schedConfig.slotDuration));
  const [dayStartHour, setDayStartHour] = useState(schedConfig.dayStartHour);
  const [dayEndHour, setDayEndHour] = useState(schedConfig.dayEndHour);

  const updateEvent = useMutation(
    trpc.events.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.events.getById.queryFilter({ id: event.id }));
        toast.success("Event settings saved");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    updateEvent.mutate({
      id: event.id,
      name: (formData.get("name") as string).trim(),
      description: (formData.get("description") as string) || undefined,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      timezone,
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
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="name">Event Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={event.name}
          disabled={isCompleted}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={event.description ?? ""}
          placeholder="Add a description for your event..."
          disabled={isCompleted}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={formatDateForInput(event.startDate)}
            disabled={isCompleted}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={formatDateForInput(event.endDate)}
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

      <Button type="submit" disabled={isCompleted || updateEvent.isPending}>
        {updateEvent.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
