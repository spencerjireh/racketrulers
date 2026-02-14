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

  const { data: allGames, isLoading } = useQuery(
    trpc.games.listByTournament.queryOptions({ tournamentId })
  );

  // Group games by round -> pool
  const grouped = new Map<
    string,
    {
      roundName: string;
      roundId: string;
      roundType: string;
      pools: Map<string, { poolName: string; games: typeof allGames }>;
      unpooledGames: typeof allGames;
    }
  >();

  if (allGames) {
    for (const game of allGames) {
      const roundId = game.round.id;
      if (!grouped.has(roundId)) {
        grouped.set(roundId, {
          roundName: game.round.name,
          roundId,
          roundType: game.round.type,
          pools: new Map(),
          unpooledGames: [],
        });
      }
      const roundGroup = grouped.get(roundId)!;

      if (game.pool) {
        if (!roundGroup.pools.has(game.pool.id)) {
          roundGroup.pools.set(game.pool.id, {
            poolName: game.pool.name,
            games: [],
          });
        }
        roundGroup.pools.get(game.pool.id)!.games!.push(game);
      } else {
        roundGroup.unpooledGames!.push(game);
      }
    }
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <LoadingState text="Loading games..." />
      ) : grouped.size > 0 ? (
        Array.from(grouped.entries()).map(([roundId, roundGroup]) => (
          <Card key={roundId}>
            <CardHeader>
              <CardTitle>{roundGroup.roundName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {roundGroup.pools.size > 0 &&
                Array.from(roundGroup.pools.entries()).map(
                  ([poolId, poolGroup]) => (
                    <div key={poolId} className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground">
                        {poolGroup.poolName}
                      </h4>
                      <GamesList
                        games={poolGroup.games!}
                        tournamentId={tournamentId}
                        scoringConfig={scoringConfig}
                      />
                      {roundGroup.roundType === "ROUND_ROBIN" && (
                        <StandingsTable
                          roundId={roundId}
                          poolId={poolId}
                          title={`${poolGroup.poolName} Standings`}
                        />
                      )}
                    </div>
                  )
                )}

              {roundGroup.unpooledGames!.length > 0 && (
                <GamesList
                  games={roundGroup.unpooledGames!}
                  tournamentId={tournamentId}
                  scoringConfig={scoringConfig}
                />
              )}

              {roundGroup.roundType === "ROUND_ROBIN" &&
                roundGroup.pools.size === 0 && (
                  <StandingsTable roundId={roundId} />
                )}
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              No games to score. Generate games in the Schedule tab first.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
