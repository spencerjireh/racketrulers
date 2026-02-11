"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const SPORTS = [
  "Basketball",
  "Soccer",
  "Volleyball",
  "Tennis",
  "Badminton",
  "Table Tennis",
  "Baseball",
  "Softball",
  "Football",
  "Rugby",
  "Cricket",
  "Hockey",
  "Futsal",
  "Handball",
  "Swimming",
  "Track & Field",
  "Esports",
  "Other",
];

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

interface EventSettingsFormProps {
  event: {
    id: string;
    name: string;
    sport: string;
    description: string | null;
    startDate: Date;
    endDate: Date;
    timezone: string;
    status: "PUBLISHED" | "COMPLETED";
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

  const [sport, setSport] = useState(
    SPORTS.includes(event.sport) ? event.sport : "Other"
  );
  const [customSport, setCustomSport] = useState(
    SPORTS.includes(event.sport) ? "" : event.sport
  );
  const [timezone, setTimezone] = useState(event.timezone);

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
    const resolvedSport = sport === "Other" ? customSport : sport;

    updateEvent.mutate({
      id: event.id,
      name: (formData.get("name") as string).trim(),
      sport: resolvedSport.trim(),
      description: (formData.get("description") as string) || undefined,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      timezone,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
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
        <Label>Sport</Label>
        <Select value={sport} onValueChange={setSport} disabled={isCompleted}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sport === "Other" && (
          <Input
            placeholder="Enter sport name"
            value={customSport}
            onChange={(e) => setCustomSport(e.target.value)}
            disabled={isCompleted}
          />
        )}
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

      <Button type="submit" disabled={isCompleted || updateEvent.isPending}>
        {updateEvent.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
