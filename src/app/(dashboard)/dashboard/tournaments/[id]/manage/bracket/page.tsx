"use client";

import { use, useMemo, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { RoundsManager } from "@/components/tournaments/rounds-manager";
import { ScoresManager } from "@/components/tournaments/scores-manager";
import { ScheduleCalendar } from "@/components/tournaments/schedule-calendar";
import { BracketView } from "@/components/tournaments/bracket-view";
import { AutoScheduleDialog } from "@/components/tournaments/auto-schedule-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
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
  const [autoScheduleOpen, setAutoScheduleOpen] = useState(false);

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

  const totalGames = useMemo(
    () => rounds?.reduce((sum, r) => sum + r._count.games, 0) ?? 0,
    [rounds]
  );

  const dayCount = useMemo(() => {
    if (!tournament) return 0;
    const start = new Date(tournament.startDate);
    const end = new Date(tournament.endDate);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }, [tournament]);

  if (isLoading) {
    return <LoadingState text="Loading bracket..." />;
  }

  if (!tournament) {
    return <p className="text-sm text-muted-foreground">Tournament not found.</p>;
  }

  const courtCount = tournament.locations?.length ?? 0;
  const defaultTab = singleElimRound ? "bracket" : "rounds";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAutoScheduleOpen(true)}
          disabled={totalGames === 0 || courtCount === 0}
        >
          <CalendarClock className="mr-2 h-4 w-4" />
          Auto Schedule
        </Button>
      </div>

      <AutoScheduleDialog
        open={autoScheduleOpen}
        onOpenChange={setAutoScheduleOpen}
        tournamentId={tournamentId}
        courtCount={courtCount}
        gameCount={totalGames}
        dayCount={dayCount}
      />

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
