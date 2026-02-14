"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GamesList } from "./games-list";
import { RoundsManager } from "./rounds-manager";
import { useRealtimeTournament } from "@/hooks/use-realtime-event";
import { LoadingState } from "@/components/ui/loading-state";

export function ScheduleView({ tournamentId }: { tournamentId: string }) {
  const trpc = useTRPC();

  useRealtimeTournament(tournamentId);

  const { data: allGames, isLoading } = useQuery(
    trpc.games.listByTournament.queryOptions({ tournamentId })
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>All Games</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : allGames && allGames.length > 0 ? (
            <GamesList games={allGames} tournamentId={tournamentId} showPool />
          ) : (
            <p className="text-sm text-muted-foreground">
              No games generated yet. Create rounds, assign teams, and generate
              games.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage Rounds</CardTitle>
        </CardHeader>
        <CardContent>
          <RoundsManager tournamentId={tournamentId} />
        </CardContent>
      </Card>
    </div>
  );
}
