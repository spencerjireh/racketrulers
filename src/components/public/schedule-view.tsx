"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { GameCard } from "./game-card";

interface PublicScheduleViewProps {
  eventId: string;
}

export function PublicScheduleView({ eventId }: PublicScheduleViewProps) {
  const trpc = useTRPC();

  const { data: games, isLoading } = useQuery(
    trpc.games.listByEventPublic.queryOptions({ eventId })
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading schedule...</p>;
  }

  if (!games || games.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No games scheduled yet.
      </p>
    );
  }

  // Group by category -> round
  const grouped = new Map<
    string,
    {
      categoryName: string;
      rounds: Map<string, { roundName: string; games: typeof games }>;
    }
  >();

  for (const game of games) {
    const catId = game.round.category.id;
    const catName = game.round.category.name;
    if (!grouped.has(catId)) {
      grouped.set(catId, { categoryName: catName, rounds: new Map() });
    }
    const catGroup = grouped.get(catId)!;

    const roundId = game.round.id;
    if (!catGroup.rounds.has(roundId)) {
      catGroup.rounds.set(roundId, { roundName: game.round.name, games: [] });
    }
    catGroup.rounds.get(roundId)!.games!.push(game);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([catId, catGroup]) => (
        <div key={catId} className="space-y-3">
          <h2 className="text-lg font-semibold">{catGroup.categoryName}</h2>
          {Array.from(catGroup.rounds.entries()).map(([roundId, roundGroup]) => (
            <div key={roundId} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {roundGroup.roundName}
              </h3>
              <div className="grid gap-2 md:grid-cols-2">
                {roundGroup.games!.map((game) => (
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
      ))}
    </div>
  );
}
