"use client";

import { useState, useMemo } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";
import { SlotPicker } from "./slot-picker";
import { BookingConfirmation } from "./booking-confirmation";

interface BookingPageProps {
  slug: string;
}

export function BookingPage({ slug }: BookingPageProps) {
  const trpc = useTRPC();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookerName, setBookerName] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data: coach, isLoading: coachLoading } = useQuery(
    trpc.bookings.getCoachPublic.queryOptions({ slug })
  );

  const from = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  const to = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return d.toISOString().split("T")[0];
  }, []);

  const { data: availableSlots } = useQuery({
    ...trpc.bookings.getAvailableSlots.queryOptions({ slug, from, to }),
    enabled: !!coach,
  });

  const createBooking = useMutation(
    trpc.bookings.create.mutationOptions({
      onSuccess: () => {
        setConfirmed(true);
        toast.success("Booking confirmed");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (coachLoading) {
    return <LoadingState />;
  }

  if (!coach) {
    return <p className="text-sm text-muted-foreground">Coach not found.</p>;
  }

  if (confirmed) {
    return (
      <BookingConfirmation
        coachName={coach.displayName}
        date={selectedDate}
        startTime={selectedSlot!}
        bookerName={bookerName}
      />
    );
  }

  const availableDates = Object.keys(availableSlots ?? {}).sort();
  const slotsForDate = selectedDate
    ? (availableSlots?.[selectedDate] ?? [])
    : [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !selectedSlot || !bookerName.trim() || !bookerEmail.trim())
      return;

    createBooking.mutate({
      slug,
      date: selectedDate,
      startTime: selectedSlot,
      bookerName: bookerName.trim(),
      bookerEmail: bookerEmail.trim(),
      message: message.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">{coach.displayName}</h1>
        <p className="text-sm text-muted-foreground">
          {coach.sessionDurationMinutes}-minute sessions | {coach.timezone}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select a Date</CardTitle>
        </CardHeader>
        <CardContent>
          {availableDates.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {availableDates.map((date) => {
                const d = new Date(date + "T12:00:00");
                return (
                  <Button
                    key={date}
                    variant={selectedDate === date ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedSlot(null);
                    }}
                    className="flex flex-col h-auto py-2"
                  >
                    <span className="text-xs">
                      {d.toLocaleDateString([], { weekday: "short" })}
                    </span>
                    <span className="text-sm font-bold">
                      {d.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No available dates in the next 4 weeks.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>Select a Time</CardTitle>
          </CardHeader>
          <CardContent>
            <SlotPicker
              slots={slotsForDate}
              selectedSlot={selectedSlot}
              onSelect={setSelectedSlot}
            />
          </CardContent>
        </Card>
      )}

      {selectedSlot && (
        <Card>
          <CardHeader>
            <CardTitle>Your Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="booker-name">Name *</Label>
                <Input
                  id="booker-name"
                  value={bookerName}
                  onChange={(e) => setBookerName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="booker-email">Email *</Label>
                <Input
                  id="booker-email"
                  type="email"
                  value={bookerEmail}
                  onChange={(e) => setBookerEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="booking-message">Message (optional)</Label>
                <Textarea
                  id="booking-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Any notes for the coach..."
                  rows={3}
                />
              </div>
              <Button
                type="submit"
                disabled={createBooking.isPending}
                className="w-full"
              >
                {createBooking.isPending ? "Booking..." : "Confirm Booking"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
