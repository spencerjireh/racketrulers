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

  const { data: matches, isLoading } = useQuery(
    trpc.matches.listByTournamentPublic.queryOptions({ tournamentId })
  );

  if (isLoading) {
    return <LoadingState text="Loading schedule..." />;
  }

  if (!matches || matches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No matches scheduled yet.
      </p>
    );
  }

  // Group by round number
  const grouped = new Map<number | null, typeof matches>();
  for (const match of matches) {
    const round = match.round ?? null;
    if (!grouped.has(round)) grouped.set(round, []);
    grouped.get(round)!.push(match);
  }

  const sortedRounds = Array.from(grouped.keys()).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  return (
    <div className="space-y-6">
      {sortedRounds.map((round) => (
        <div key={round ?? "unrounded"} className="space-y-2">
          {round !== null && (
            <h2 className="text-lg font-semibold">Round {round}</h2>
          )}
          <div className="grid gap-2 md:grid-cols-2">
            {grouped.get(round)!.map((match) => (
              <GameCard
                key={match.id}
                participant1Name={match.participant1?.name ?? "TBD"}
                participant2Name={match.participant2?.name ?? "TBD"}
                scoreParticipant1={match.scoreParticipant1}
                scoreParticipant2={match.scoreParticipant2}
                setScores={match.setScores as { team1: number; team2: number }[] | null}
                matchType={match.matchType}
                status={match.status}
                scheduledAt={match.scheduledAt}
                locationName={match.location?.name ?? null}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
