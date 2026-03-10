"use client";

import { StandingsTable } from "@/components/tournaments/standings-table";

interface StandingsViewProps {
  tournamentId: string;
}

export function PublicStandingsView({ tournamentId }: StandingsViewProps) {
  return <StandingsTable tournamentId={tournamentId} />;
}
