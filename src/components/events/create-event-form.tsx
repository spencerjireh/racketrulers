"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export function CreateEventForm() {
  const router = useRouter();
  const trpc = useTRPC();
  const [sport, setSport] = useState("");
  const [customSport, setCustomSport] = useState("");
  const [timezone, setTimezone] = useState("America/Toronto");
  const [error, setError] = useState("");

  const createEvent = useMutation(trpc.events.create.mutationOptions());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const resolvedSport = sport === "Other" ? customSport : sport;

    if (!name.trim()) {
      setError("Event name is required");
      return;
    }
    if (!resolvedSport.trim()) {
      setError("Sport is required");
      return;
    }
    if (!startDate || !endDate) {
      setError("Start and end dates are required");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after start date");
      return;
    }

    try {
      const event = await createEvent.mutateAsync({
        name: name.trim(),
        sport: resolvedSport.trim(),
        startDate,
        endDate,
        timezone,
      });
      router.push(`/dashboard/events/${event.id}/manage/settings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Event Name</Label>
        <Input id="name" name="name" placeholder="Spring Tournament 2026" />
      </div>

      <div className="space-y-2">
        <Label>Sport</Label>
        <Select value={sport} onValueChange={setSport}>
          <SelectTrigger>
            <SelectValue placeholder="Select a sport" />
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
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" name="startDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone}>
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

      <Button type="submit" disabled={createEvent.isPending}>
        {createEvent.isPending ? "Creating..." : "Create Event"}
      </Button>
    </form>
  );
}
