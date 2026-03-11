"use client";

import { useState, useMemo } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { toLocalDateStr, getMonday } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { WeekView } from "./week-view";
import { BookingConfirmation } from "./booking-confirmation";
import { toast } from "sonner";

export function BookingPage() {
  const trpc = useTRPC();
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookerName, setBookerName] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const now = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [weekStart, setWeekStart] = useState(() => getMonday(now));

  const { data: coach, isLoading: coachLoading } = useQuery(
    trpc.coach.getPublic.queryOptions()
  );

  const from = useMemo(() => toLocalDateStr(new Date()), []);

  const to = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 56);
    return toLocalDateStr(d);
  }, []);

  const { data: availableSlots } = useQuery({
    ...trpc.bookings.getAvailableSlots.queryOptions({ from, to }),
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

  if (confirmed && selectedSlot) {
    return (
      <BookingConfirmation
        coachName={coach.displayName}
        date={selectedDate}
        startTime={selectedSlot}
        bookerName={bookerName}
      />
    );
  }

  const availableDateSet = new Set(Object.keys(availableSlots ?? {}));

  function handleDayClick(date: string) {
    setWeekStart(getMonday(new Date(date + "T00:00:00")));
    setSelectedDate("");
    setSelectedSlot(null);
    setView("week");
  }

  function handleSlotSelect(date: string, slot: string) {
    setSelectedDate(date);
    setSelectedSlot(slot);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !selectedSlot || !bookerName.trim() || !bookerEmail.trim())
      return;

    createBooking.mutate({
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
          {coach.sessionDurationMinutes}-minute sessions
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={view === "month" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("month")}
        >
          Month
        </Button>
        <Button
          variant={view === "week" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("week")}
        >
          Week
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {view === "month" ? "Select a Date" : "Select a Time"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {view === "month" ? (
            <MonthCalendar
              month={currentMonth}
              year={currentYear}
              availableDates={availableDateSet}
              selectedDate={null}
              onSelect={handleDayClick}
              onMonthChange={(m, y) => {
                setCurrentMonth(m);
                setCurrentYear(y);
              }}
              slotsByDate={availableSlots}
            />
          ) : (
            <WeekView
              weekStart={weekStart}
              slotsByDate={availableSlots ?? {}}
              selectedDate={selectedDate || null}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSlotSelect}
              onWeekChange={setWeekStart}
            />
          )}
        </CardContent>
      </Card>

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
