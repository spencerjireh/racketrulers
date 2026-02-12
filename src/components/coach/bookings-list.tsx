"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/loading-state";
import { CancelBookingDialog } from "./cancel-booking-dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

type FilterValue = "all" | "CONFIRMED" | "CANCELLED" | "past";

interface CancelTarget {
  id: string;
  name: string;
  date: string;
  time: string;
}

export function BookingsList() {
  const trpc = useTRPC();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);

  const queryInput = {
    page,
    pageSize: 10,
    ...(filter === "CONFIRMED" || filter === "CANCELLED"
      ? { status: filter as "CONFIRMED" | "CANCELLED" }
      : {}),
    ...(filter === "past"
      ? { to: new Date().toISOString().split("T")[0] }
      : {}),
  };

  const { data, isLoading } = useQuery(
    trpc.coach.listBookings.queryOptions(queryInput)
  );

  const bookings = data?.bookings ?? [];
  const totalPages = data?.totalPages ?? 0;
  const currentPage = data?.currentPage ?? 1;

  function handleFilterChange(value: string) {
    setFilter(value as FilterValue);
    setPage(1);
  }

  const emptyMessages: Record<FilterValue, string> = {
    all: "No bookings yet.",
    CONFIRMED: "No confirmed bookings.",
    CANCELLED: "No cancelled bookings.",
    past: "No past bookings.",
  };

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={handleFilterChange}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="CONFIRMED">Confirmed</TabsTrigger>
          <TabsTrigger value="CANCELLED">Cancelled</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <LoadingState text="Loading bookings..." />
      ) : bookings.length > 0 ? (
        <>
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
                        booking.status === "CONFIRMED" ? "default" : "secondary"
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
                        onClick={() =>
                          setCancelTarget({
                            id: booking.id,
                            name: booking.bookerName,
                            date: booking.date as unknown as string,
                            time: booking.startTime,
                          })
                        }
                      >
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={currentPage >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground py-4">
          {emptyMessages[filter]}
        </p>
      )}

      {cancelTarget && (
        <CancelBookingDialog
          bookingId={cancelTarget.id}
          bookerName={cancelTarget.name}
          date={cancelTarget.date}
          startTime={cancelTarget.time}
          open={!!cancelTarget}
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null);
          }}
        />
      )}
    </div>
  );
}
