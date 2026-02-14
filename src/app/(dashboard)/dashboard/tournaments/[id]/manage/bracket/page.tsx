"use client";

import { use, useMemo } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { RoundsManager } from "@/components/tournaments/rounds-manager";
import { ScoresManager } from "@/components/tournaments/scores-manager";
import { ScheduleCalendar } from "@/components/tournaments/schedule-calendar";
import { BracketView } from "@/components/tournaments/bracket-view";
import { LoadingState } from "@/components/ui/loading-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRealtimeTournament } from "@/hooks/use-realtime-event";

export default function TournamentBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = use(params);
  const trpc = useTRPC();
  useRealtimeTournament(tournamentId);

  const { data: tournament, isLoading } = useQuery(
    trpc.tournaments.getById.queryOptions({ id: tournamentId })
  );

  const { data: rounds } = useQuery(
    trpc.rounds.list.queryOptions({ tournamentId })
  );

  // Find the single-elim round that has games generated
  const singleElimRound = useMemo(
    () =>
      rounds?.find(
        (r) => r.type === "SINGLE_ELIM" && r._count.games > 0
      ) ?? null,
    [rounds]
  );

  if (isLoading) {
    return <LoadingState text="Loading bracket..." />;
  }

  if (!tournament) {
    return <p className="text-sm text-muted-foreground">Tournament not found.</p>;
  }

  const defaultTab = singleElimRound ? "bracket" : "rounds";

  return (
    <div className="space-y-6">
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {singleElimRound && (
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
          )}
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        {singleElimRound && (
          <TabsContent value="bracket" className="mt-4">
            <BracketView
              tournamentId={tournamentId}
              roundId={singleElimRound.id}
              interactive
              scoringConfig={
                tournament.scoringConfig as {
                  pointsPerSet: number;
                  totalSets: number;
                  deuceEnabled: boolean;
                  maxPoints: number;
                } | undefined
              }
            />
          </TabsContent>
        )}

        <TabsContent value="rounds" className="mt-4">
          <RoundsManager tournamentId={tournamentId} />
        </TabsContent>

        <TabsContent value="scores" className="mt-4">
          <ScoresManager tournamentId={tournamentId} />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <ScheduleCalendar tournamentId={tournamentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
