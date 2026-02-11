"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const TIMEZONES = [
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function ProfileSetup() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [duration, setDuration] = useState(60);
  const [timezone, setTimezone] = useState("America/Toronto");

  const createProfile = useMutation(
    trpc.coach.createProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.coach.getProfile.queryFilter());
        toast.success("Coach profile created");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !slug.trim()) return;
    createProfile.mutate({
      displayName: displayName.trim(),
      slug: slug.trim().toLowerCase(),
      sessionDurationMinutes: duration,
      timezone,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Up Coach Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name *</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Coach Smith"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">
              Booking URL Slug *
            </Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">/book/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder="coach-smith"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only. Cannot be changed later.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Session Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min={15}
              max={480}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
            />
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
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={createProfile.isPending}>
            {createProfile.isPending ? "Creating..." : "Create Profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
