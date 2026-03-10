"use client";

import { BracketView } from "@/components/tournaments/bracket-view";
import { useRealtimeTournament } from "@/hooks/use-realtime-event";

interface PublicBracketClientProps {
  tournamentId: string;
}

export function PublicBracketClient({ tournamentId }: PublicBracketClientProps) {
  useRealtimeTournament(tournamentId);

  return <BracketView tournamentId={tournamentId} />;
}
