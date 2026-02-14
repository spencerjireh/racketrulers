"use client";

import { BracketView } from "@/components/tournaments/bracket-view";
import { useRealtimeTournament } from "@/hooks/use-realtime-event";

interface PublicBracketClientProps {
  tournamentId: string;
  roundId: string;
}

export function PublicBracketClient({
  tournamentId,
  roundId,
}: PublicBracketClientProps) {
  useRealtimeTournament(tournamentId);

  return (
    <BracketView
      tournamentId={tournamentId}
      roundId={roundId}
    />
  );
}
