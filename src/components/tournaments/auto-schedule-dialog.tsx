"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface AutoScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  courtCount: number;
  gameCount: number;
  dayCount: number;
}

export function AutoScheduleDialog({
  open,
  onOpenChange,
  tournamentId,
  courtCount,
  gameCount,
  dayCount,
}: AutoScheduleDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [gameDuration, setGameDuration] = useState(30);
  const [breakTime, setBreakTime] = useState(10);
  const [dayStartHour, setDayStartHour] = useState(8);
  const [dayEndHour, setDayEndHour] = useState(20);
  const [clearExisting, setClearExisting] = useState(true);

  const autoSchedule = useMutation(
    trpc.games.autoSchedule.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: [["games"]],
        });
        toast.success(`Scheduled ${data.scheduled} games`);
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    autoSchedule.mutate({
      tournamentId,
      config: {
        gameDurationMinutes: gameDuration,
        breakBetweenMinutes: breakTime,
        dayStartHour,
        dayEndHour,
      },
      clearExisting,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Auto Schedule</DialogTitle>
          <DialogDescription>
            Automatically assign times and courts to all games.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {gameCount} games / {courtCount} court{courtCount !== 1 ? "s" : ""} / {dayCount} day{dayCount !== 1 ? "s" : ""}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gameDuration">Game duration (min)</Label>
              <Input
                id="gameDuration"
                type="number"
                min={5}
                max={300}
                value={gameDuration}
                onChange={(e) => setGameDuration(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="breakTime">Break between (min)</Label>
              <Input
                id="breakTime"
                type="number"
                min={0}
                max={120}
                value={breakTime}
                onChange={(e) => setBreakTime(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dayStart">Day starts at</Label>
              <Input
                id="dayStart"
                type="number"
                min={0}
                max={23}
                value={dayStartHour}
                onChange={(e) => setDayStartHour(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dayEnd">Day ends at</Label>
              <Input
                id="dayEnd"
                type="number"
                min={1}
                max={24}
                value={dayEndHour}
                onChange={(e) => setDayEndHour(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="clearExisting"
              checked={clearExisting}
              onCheckedChange={(checked) => setClearExisting(checked === true)}
            />
            <Label htmlFor="clearExisting" className="text-sm font-normal">
              Clear existing schedule
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={autoSchedule.isPending}>
              {autoSchedule.isPending ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
