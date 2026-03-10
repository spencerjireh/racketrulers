"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, toLocalDateStr } from "@/lib/utils";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatSlotTime(time: string): string {
  const [h] = time.split(":").map(Number);
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

interface MonthCalendarProps {
  month: number; // 0-11
  year: number;
  availableDates?: Set<string>;
  selectedDate?: string | null;
  onSelect?: (date: string) => void;
  onMonthChange: (month: number, year: number) => void;
  slotsByDate?: Record<string, string[]>;
  renderDay?: (dateStr: string, day: number) => ReactNode;
}

export function MonthCalendar({
  month,
  year,
  availableDates,
  selectedDate,
  onSelect,
  onMonthChange,
  slotsByDate,
  renderDay,
}: MonthCalendarProps) {
  const today = useMemo(() => toLocalDateStr(new Date()), []);

  const { firstDayOffset, daysInMonth } = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return { firstDayOffset: firstDay, daysInMonth: days };
  }, [month, year]);

  function prevMonth() {
    if (month === 0) {
      onMonthChange(11, year - 1);
    } else {
      onMonthChange(month - 1, year);
    }
  }

  function nextMonth() {
    if (month === 11) {
      onMonthChange(0, year + 1);
    } else {
      onMonthChange(month + 1, year);
    }
  }

  const monthLabel = new Date(year, month).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const hasSlotPreviews = !!slotsByDate;
  const hasExpandedCells = hasSlotPreviews || !!renderDay;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}

        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} className={hasExpandedCells ? "min-h-[72px]" : ""} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = toLocalDateStr(new Date(year, month, day));

          if (renderDay) {
            return (
              <div
                key={dateStr}
                className={cn(
                  "min-h-[72px] rounded-md border p-1 flex flex-col gap-0.5",
                  dateStr === today && "ring-1 ring-primary/30"
                )}
              >
                {renderDay(dateStr, day)}
              </div>
            );
          }

          const isAvailable = availableDates?.has(dateStr) ?? false;
          const isSelected = selectedDate === dateStr;
          const isPast = dateStr < today;
          const daySlots = slotsByDate?.[dateStr];

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!isAvailable || isPast}
              onClick={() => onSelect?.(dateStr)}
              className={cn(
                "w-full rounded-md text-sm transition-colors",
                hasSlotPreviews
                  ? "min-h-[72px] flex flex-col items-center pt-1.5 gap-0.5"
                  : "h-9",
                isSelected
                  ? "bg-primary text-primary-foreground font-medium"
                  : isAvailable && !isPast
                    ? "bg-primary/10 hover:bg-primary/20 cursor-pointer font-medium"
                    : "text-muted-foreground opacity-50 cursor-not-allowed",
                dateStr === today && !isSelected && "ring-1 ring-primary/30"
              )}
            >
              <span>{day}</span>
              {hasSlotPreviews && daySlots && daySlots.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 px-0.5">
                  {daySlots.slice(0, 3).map((slot) => (
                    <span
                      key={slot}
                      className={cn(
                        "text-[10px] rounded px-1 leading-tight",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {formatSlotTime(slot)}
                    </span>
                  ))}
                  {daySlots.length > 3 && (
                    <span
                      className={cn(
                        "text-[10px] rounded px-1 leading-tight",
                        isSelected
                          ? "text-primary-foreground/70"
                          : "text-primary/70"
                      )}
                    >
                      +{daySlots.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
