"use client";

import { useRealtimeTournament } from "@/hooks/use-realtime-event";

export function RealtimeWrapper({ tournamentId }: { tournamentId: string }) {
  useRealtimeTournament(tournamentId);
  return null;
}
