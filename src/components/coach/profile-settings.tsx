"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { TIMEZONES } from "@/lib/constants";

const DURATION_PRESETS = [30, 45, 60, 90, 120];

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
  const [copied, setCopied] = useState(false);
  const [customDuration, setCustomDuration] = useState(
    !DURATION_PRESETS.includes(profile.sessionDurationMinutes)
  );

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

  async function handleCopyUrl() {
    const url = `${window.location.origin}/book/${profile.slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label>Booking URL</Label>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md truncate">
            /book/{profile.slug}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleCopyUrl}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
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
        <Label>Session Duration (minutes)</Label>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((d) => (
            <Button
              key={d}
              type="button"
              variant={!customDuration && duration === d ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDuration(d);
                setCustomDuration(false);
              }}
            >
              {d}
            </Button>
          ))}
          <Button
            type="button"
            variant={customDuration ? "default" : "outline"}
            size="sm"
            onClick={() => setCustomDuration(true)}
          >
            Custom
          </Button>
        </div>
        {customDuration && (
          <Input
            type="number"
            min={15}
            max={480}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
            className="w-32 mt-2"
          />
        )}
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
  );
}
