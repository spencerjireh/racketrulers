"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
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

type TournamentFormat = "ROUND_ROBIN" | "SINGLE_ELIM" | "DOUBLE_ELIM" | "SWISS";

export function CreateTournamentForm() {
  const router = useRouter();
  const trpc = useTRPC();
  const [timezone, setTimezone] = useState("Asia/Manila");
  const [format, setFormat] = useState<TournamentFormat>("ROUND_ROBIN");
  const [error, setError] = useState("");

  const createTournament = useMutation(trpc.tournaments.create.mutationOptions());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || undefined;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;

    if (!name.trim()) {
      setError("Tournament name is required");
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
      const tournament = await createTournament.mutateAsync({
        name: name.trim(),
        description,
        startDate,
        endDate,
        timezone,
        format,
      });
      router.push(`/dashboard/tournaments/${tournament.id}/manage/participants`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Tournament Name</Label>
        <Input id="name" name="name" placeholder="Spring Badminton Open 2026" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Add a description for your tournament..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Format</Label>
        <Select value={format} onValueChange={(v) => setFormat(v as TournamentFormat)}>
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

      <Button type="submit" disabled={createTournament.isPending}>
        {createTournament.isPending ? "Creating..." : "Create Tournament"}
      </Button>
    </form>
  );
}
