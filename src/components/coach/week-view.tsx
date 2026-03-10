"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, toLocalDateStr, getMonday } from "@/lib/utils";

interface WeekViewProps {
  weekStart: Date;
  slotsByDate: Record<string, string[]>;
  selectedDate: string | null;
  selectedSlot: string | null;
  onSelectSlot: (date: string, slot: string) => void;
  onWeekChange: (weekStart: Date) => void;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekView({
  weekStart,
  slotsByDate,
  selectedDate,
  selectedSlot,
  onSelectSlot,
  onWeekChange,
}: WeekViewProps) {
  const monday = useMemo(() => getMonday(weekStart), [weekStart]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return {
        name: DAY_NAMES[i],
        date: d,
        dateStr: toLocalDateStr(d),
      };
    });
  }, [monday]);

  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);

  const weekLabel = useMemo(() => {
    const end = new Date(monday);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${monday.toLocaleDateString(undefined, opts)} - ${end.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
  }, [monday]);

  function prevWeek() {
    const d = new Date(monday);
    d.setDate(d.getDate() - 7);
    onWeekChange(d);
  }

  function nextWeek() {
    const d = new Date(monday);
    d.setDate(d.getDate() + 7);
    onWeekChange(d);
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{weekLabel}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-2 min-w-[700px]">
          {weekDays.map(({ name, date, dateStr }) => {
            const isPast = dateStr < todayStr;
            const daySlots = slotsByDate[dateStr] ?? [];

            return (
              <div key={dateStr} className="flex flex-col">
                <div
                  className={cn(
                    "text-center text-xs font-medium py-1.5 rounded-t-md border-b",
                    dateStr === todayStr
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <div>{name}</div>
                  <div className="text-sm font-semibold">
                    {date.getDate()}
                  </div>
                </div>
                <div className="flex flex-col gap-1 p-1 min-h-[120px]">
                  {isPast ? (
                    <span className="text-xs text-muted-foreground/50 text-center mt-2">
                      Past
                    </span>
                  ) : daySlots.length === 0 ? (
                    <span className="text-xs text-muted-foreground/50 text-center mt-2">
                      No slots
                    </span>
                  ) : (
                    daySlots.map((slot) => (
                      <Button
                        key={slot}
                        variant={
                          selectedDate === dateStr && selectedSlot === slot
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => onSelectSlot(dateStr, slot)}
                      >
                        {slot}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

