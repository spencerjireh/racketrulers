"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthCalendarProps {
  month: number; // 0-11
  year: number;
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelect: (date: string) => void;
  onMonthChange: (month: number, year: number) => void;
}

export function MonthCalendar({
  month,
  year,
  availableDates,
  selectedDate,
  onSelect,
  onMonthChange,
}: MonthCalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

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
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isAvailable = availableDates.has(dateStr);
          const isSelected = selectedDate === dateStr;
          const isPast = dateStr < today;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!isAvailable || isPast}
              onClick={() => onSelect(dateStr)}
              className={cn(
                "h-9 w-full rounded-md text-sm transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground font-medium"
                  : isAvailable && !isPast
                    ? "bg-primary/10 hover:bg-primary/20 cursor-pointer font-medium"
                    : "text-muted-foreground opacity-50 cursor-not-allowed",
                dateStr === today && !isSelected && "ring-1 ring-primary/30"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
