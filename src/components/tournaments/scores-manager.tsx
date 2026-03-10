"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GamesList } from "./games-list";
import { StandingsTable } from "./standings-table";
import { useRealtimeTournament } from "@/hooks/use-realtime-event";
import { LoadingState } from "@/components/ui/loading-state";

interface ScoringConfig {
  pointsPerSet: number;
  totalSets: number;
  deuceEnabled: boolean;
  maxPoints: number;
}

export function ScoresManager({ tournamentId }: { tournamentId: string }) {
  const trpc = useTRPC();

  useRealtimeTournament(tournamentId);

  const { data: tournament } = useQuery(
    trpc.tournaments.getById.queryOptions({ id: tournamentId })
  );

  const scoringConfig = (tournament?.scoringConfig as ScoringConfig | undefined) ?? {
    pointsPerSet: 21,
    totalSets: 3,
    deuceEnabled: true,
    maxPoints: 30,
  };

  const { data: allMatches, isLoading } = useQuery(
    trpc.matches.listByTournament.queryOptions({ tournamentId })
  );

  const isRoundRobin = tournament?.format === "ROUND_ROBIN";

  // Group matches by round number (null rounds go last)
  const grouped = new Map<number | null, typeof allMatches>();

  if (allMatches) {
    for (const match of allMatches) {
      const round = match.round ?? null;
      if (!grouped.has(round)) grouped.set(round, []);
      grouped.get(round)!.push(match);
    }
  }

  // Sort: numbered rounds first (ascending), then null
  const sortedRounds = Array.from(grouped.keys()).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        <LoadingState text="Loading matches..." />
      ) : grouped.size > 0 ? (
        <>
          {sortedRounds.map((round) => (
            <Card key={round ?? "unrounded"}>
              <CardHeader>
                <CardTitle>{round !== null ? `Round ${round}` : "Matches"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <GamesList
                  games={grouped.get(round)!}
                  tournamentId={tournamentId}
                  scoringConfig={scoringConfig}
                />
              </CardContent>
            </Card>
          ))}

          {isRoundRobin && (
            <Card>
              <CardHeader>
                <CardTitle>Standings</CardTitle>
              </CardHeader>
              <CardContent>
                <StandingsTable tournamentId={tournamentId} />
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              No matches to score. Start the tournament to generate matches.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
