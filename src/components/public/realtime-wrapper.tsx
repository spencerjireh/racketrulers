"use client";

import { useRealtimeEvent } from "@/hooks/use-realtime-event";

export function RealtimeWrapper({ eventId }: { eventId: string }) {
  useRealtimeEvent(eventId);
  return null;
}
