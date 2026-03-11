"use client";

import { BracketView } from "@/components/tournaments/bracket-view";
import { useRealtimeTournament } from "@/hooks/use-realtime-event";
import { type ScoringConfig } from "@/server/lib/scoring-validation";

interface PublicBracketClientProps {
  tournamentId: string;
  interactive?: boolean;
  scoringConfig?: ScoringConfig;
}

export function PublicBracketClient({
  tournamentId,
  interactive,
  scoringConfig,
}: PublicBracketClientProps) {
  useRealtimeTournament(tournamentId);

  return (
    <BracketView
      tournamentId={tournamentId}
      interactive={interactive}
      scoringConfig={scoringConfig}
    />
  );
}
