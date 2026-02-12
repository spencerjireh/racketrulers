"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AvailabilityCalendar } from "./availability-calendar";
import { toast } from "sonner";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Click to add a time block. Click a block to select it, then delete. Drag to move.
        </p>
        <Button
          onClick={() => setAvailability.mutate({ slots })}
          disabled={setAvailability.isPending}
        >
          {setAvailability.isPending ? "Saving..." : "Save Availability"}
        </Button>
      </div>
      <AvailabilityCalendar slots={initialSlots} onChange={setSlots} />
    </div>
  );
}
