"use client";

import { useState, useEffect } from "react";
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

interface ProfileSettingsProps {
  profile: {
    slug: string;
    displayName: string;
    sessionDurationMinutes: number;
    timezone: string;
  };
}

export function ProfileSettings({ profile }: ProfileSettingsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [duration, setDuration] = useState(profile.sessionDurationMinutes);
  const [timezone, setTimezone] = useState(profile.timezone);

  useEffect(() => {
    setDisplayName(profile.displayName);
    setDuration(profile.sessionDurationMinutes);
    setTimezone(profile.timezone);
  }, [profile]);

  const updateProfile = useMutation(
    trpc.coach.updateProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.coach.getProfile.queryFilter());
        toast.success("Profile updated");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate({
      displayName: displayName.trim(),
      sessionDurationMinutes: duration,
      timezone,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label>Booking URL</Label>
            <p className="text-sm text-muted-foreground">/book/{profile.slug}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Display Name</Label>
            <Input
              id="edit-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-duration">Session Duration (minutes)</Label>
            <Input
              id="edit-duration"
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
          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
