"use client";

import { BracketView } from "@/components/tournaments/bracket-view";
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
  return (
    <BracketView
      tournamentId={tournamentId}
      interactive={interactive}
      scoringConfig={scoringConfig}
    />
  );
}
