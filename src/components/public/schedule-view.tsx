"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { GameCard } from "./game-card";
import { LoadingState } from "@/components/ui/loading-state";

interface PublicScheduleViewProps {
  tournamentId: string;
}

export function PublicScheduleView({ tournamentId }: PublicScheduleViewProps) {
  const trpc = useTRPC();

  const { data: games, isLoading } = useQuery(
    trpc.games.listByTournamentPublic.queryOptions({ tournamentId })
  );

  if (isLoading) {
    return <LoadingState text="Loading schedule..." />;
  }

  if (!games || games.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No games scheduled yet.
      </p>
    );
  }

  // Group by round
  const grouped = new Map<
    string,
    { roundName: string; games: typeof games }
  >();

  for (const game of games) {
    const roundId = game.round.id;
    if (!grouped.has(roundId)) {
      grouped.set(roundId, { roundName: game.round.name, games: [] });
    }
    grouped.get(roundId)!.games.push(game);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([roundId, roundGroup]) => (
        <div key={roundId} className="space-y-2">
          <h2 className="text-lg font-semibold">{roundGroup.roundName}</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {roundGroup.games.map((game) => (
              <GameCard
                key={game.id}
                team1Name={game.team1?.name ?? "TBD"}
                team2Name={game.team2?.name ?? "TBD"}
                scoreTeam1={game.scoreTeam1}
                scoreTeam2={game.scoreTeam2}
                setScores={game.setScores as { team1: number; team2: number }[] | null}
                matchType={game.matchType}
                status={game.status}
                scheduledAt={game.scheduledAt}
                locationName={game.location?.name ?? null}
                poolName={game.pool?.name ?? null}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
