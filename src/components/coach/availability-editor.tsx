"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface Slot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface AvailabilityEditorProps {
  initialSlots: Slot[];
}

export function AvailabilityEditor({ initialSlots }: AvailabilityEditorProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [slots, setSlots] = useState<Slot[]>(initialSlots);

  useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

  const setAvailability = useMutation(
    trpc.coach.setAvailability.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.coach.getProfile.queryFilter());
        toast.success("Availability saved");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function addSlot(dayOfWeek: number) {
    setSlots((prev) => [
      ...prev,
      { dayOfWeek, startTime: "09:00", endTime: "17:00" },
    ]);
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSlot(
    index: number,
    field: "startTime" | "endTime",
    value: string
  ) {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function handleSave() {
    setAvailability.mutate({ slots });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Weekly Availability</CardTitle>
        <Button onClick={handleSave} disabled={setAvailability.isPending}>
          {setAvailability.isPending ? "Saving..." : "Save Availability"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {DAYS.map((day, dayIndex) => {
          const daySlots = slots
            .map((s, i) => ({ ...s, originalIndex: i }))
            .filter((s) => s.dayOfWeek === dayIndex);

          return (
            <div key={day} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium w-24">{day}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => addSlot(dayIndex)}
                >
                  + Add window
                </Button>
              </div>
              {daySlots.length > 0 ? (
                daySlots.map((slot) => (
                  <div
                    key={slot.originalIndex}
                    className="flex items-center gap-2 ml-24"
                  >
                    <Input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) =>
                        updateSlot(slot.originalIndex, "startTime", e.target.value)
                      }
                      className="w-32 h-8"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) =>
                        updateSlot(slot.originalIndex, "endTime", e.target.value)
                      }
                      className="w-32 h-8"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-destructive"
                      onClick={() => removeSlot(slot.originalIndex)}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground ml-24">
                  Not available
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
