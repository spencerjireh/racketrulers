"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface CancelBookingDialogProps {
  bookingId: string;
  bookerName: string;
  date: string;
  startTime: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelBookingDialog({
  bookingId,
  bookerName,
  date,
  startTime,
  open,
  onOpenChange,
}: CancelBookingDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const cancelBooking = useMutation(
    trpc.coach.cancelBooking.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.coach.listBookings.queryFilter());
        queryClient.invalidateQueries(trpc.coach.getProfile.queryFilter());
        toast.success("Booking cancelled");
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            Cancel the booking with {bookerName} on{" "}
            {new Date(date).toLocaleDateString()} at {startTime}? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep Booking
          </Button>
          <Button
            variant="destructive"
            onClick={() => cancelBooking.mutate({ bookingId })}
            disabled={cancelBooking.isPending}
          >
            {cancelBooking.isPending ? "Cancelling..." : "Cancel Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
