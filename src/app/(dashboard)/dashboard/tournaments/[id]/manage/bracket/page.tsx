"use client";

import { use, useMemo, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
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

  const { data: allMatches } = useQuery(
    trpc.matches.listByTournament.queryOptions({ tournamentId })
  );

  const isBracketFormat =
    tournament?.format === "SINGLE_ELIM" || tournament?.format === "DOUBLE_ELIM";

  const totalMatches = allMatches?.length ?? 0;

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
  const defaultTab = isBracketFormat && totalMatches > 0 ? "bracket" : "scores";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAutoScheduleOpen(true)}
          disabled={totalMatches === 0 || courtCount === 0}
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
        gameCount={totalMatches}
        dayCount={dayCount}
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {isBracketFormat && totalMatches > 0 && (
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
          )}
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        {isBracketFormat && totalMatches > 0 && (
          <TabsContent value="bracket" className="mt-4">
            <BracketView
              tournamentId={tournamentId}
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
