"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function BookingsList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: bookings, isLoading } = useQuery(
    trpc.coach.listBookings.queryOptions({})
  );

  const cancelBooking = useMutation(
    trpc.coach.cancelBooking.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.coach.listBookings.queryFilter({}));
        queryClient.invalidateQueries(trpc.coach.getProfile.queryFilter());
        toast.success("Booking cancelled");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bookings</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading bookings...</p>
        ) : bookings && bookings.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>
                    {new Date(booking.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {booking.startTime} - {booking.endTime}
                  </TableCell>
                  <TableCell>{booking.bookerName}</TableCell>
                  <TableCell className="text-xs">
                    {booking.bookerEmail}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        booking.status === "CONFIRMED"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {booking.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">
                    {booking.message || "-"}
                  </TableCell>
                  <TableCell>
                    {booking.status === "CONFIRMED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-7 text-xs"
                        onClick={() => {
                          if (confirm("Cancel this booking?")) {
                            cancelBooking.mutate({ bookingId: booking.id });
                          }
                        }}
                        disabled={cancelBooking.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
