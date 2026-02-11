"use client";

import { Button } from "@/components/ui/button";

interface SlotPickerProps {
  slots: string[];
  selectedSlot: string | null;
  onSelect: (slot: string) => void;
}

export function SlotPicker({ slots, selectedSlot, onSelect }: SlotPickerProps) {
  if (slots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No available slots for this date.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => (
        <Button
          key={slot}
          variant={selectedSlot === slot ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(slot)}
        >
          {slot}
        </Button>
      ))}
    </div>
  );
}
