"use client";

import { useState, useMemo } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { toLocalDateStr } from "@/lib/utils";

export function BookingsCalendar() {
  const trpc = useTRPC();
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const { from, to } = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    return {
      from: toLocalDateStr(first),
      to: toLocalDateStr(last),
    };
  }, [month, year]);

  const { data, isLoading } = useQuery(
    trpc.coach.listBookings.queryOptions({
      from,
      to,
      pageSize: 50,
    })
  );

  const bookingsByDate = useMemo(() => {
    const map: Record<string, typeof bookings> = {};
    const bookings = data?.bookings ?? [];
    for (const b of bookings) {
      const dateStr = new Date(b.date).toISOString().split("T")[0];
      (map[dateStr] ??= []).push(b);
    }
    return map;
  }, [data]);

  if (isLoading) {
    return <LoadingState text="Loading calendar..." />;
  }

  return (
    <MonthCalendar
      month={month}
      year={year}
      onMonthChange={(m, y) => { setMonth(m); setYear(y); }}
      renderDay={(dateStr, day) => {
        const dayBookings = bookingsByDate[dateStr] ?? [];
        return (
          <>
            <span className="text-xs font-medium text-muted-foreground">{day}</span>
            {dayBookings.map((b) => (
              <Badge
                key={b.id}
                variant={b.status === "CONFIRMED" ? "default" : "secondary"}
                className="text-[10px] truncate justify-start font-normal px-1 py-0"
              >
                {b.startTime} {b.bookerName}
              </Badge>
            ))}
          </>
        );
      }}
    />
  );
}
