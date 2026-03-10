"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GameStatusBadge } from "./game-status-badge";
import { ScoreEntryDialog } from "./score-entry-dialog";
import { CascadeWarningDialog } from "./cascade-warning-dialog";
import { type SetScore, type ScoringConfig, DEFAULT_SCORING_CONFIG } from "@/server/lib/scoring-validation";
import { useScoreEntry } from "@/hooks/use-score-entry";

interface Match {
  id: string;
  status: string;
  matchType?: string;
  roundPosition: number | null;
  scheduledAt: string | Date | null;
  scoreParticipant1: number | null;
  scoreParticipant2: number | null;
  setScores?: unknown;
  participant1: { id: string; name: string } | null;
  participant2: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
}

interface GamesListProps {
  games: Match[];
  tournamentId: string;
  scoringConfig?: ScoringConfig;
}

function formatSetScores(setScores: SetScore[] | null | undefined): string {
  if (!setScores || setScores.length === 0) return "";
  return setScores.map((s) => `${s.team1}-${s.team2}`).join(", ");
}

export function GamesList({
  games,
  tournamentId,
  scoringConfig,
}: GamesListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const config = scoringConfig ?? DEFAULT_SCORING_CONFIG;

  const invalidateMatches = () => {
    queryClient.invalidateQueries(
      trpc.matches.listByTournament.queryFilter({ tournamentId })
    );
    queryClient.invalidateQueries(
      trpc.matches.getStandings.queryFilter()
    );
  };

  const {
    scoringGameId,
    setScoringGameId,
    cascadeInfo,
    setCascadeInfo,
    submitScore,
    submitForfeit,
    submitReset,
    confirmCascade,
    isPending,
    isResetPending,
  } = useScoreEntry(tournamentId, invalidateMatches);

  // Derive the selected game from the hook's scoringGameId — this automatically
  // closes the dialog when the hook sets scoringGameId to null on mutation success.
  const scoringGame = scoringGameId ? (games.find((g) => g.id === scoringGameId) ?? null) : null;

  if (games.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No matches to display.</p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Participant 1</TableHead>
            <TableHead className="text-center w-24">Score</TableHead>
            <TableHead>Participant 2</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Court</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {games.map((game) => (
            <TableRow key={game.id}>
              <TableCell className="text-muted-foreground text-xs">
                {game.roundPosition}
              </TableCell>
              <TableCell className="font-medium">
                {game.participant1?.name ?? "TBD"}
              </TableCell>
              <TableCell className="text-center">
                {game.scoreParticipant1 !== null && game.scoreParticipant2 !== null ? (
                  <div>
                    <div className="font-mono font-bold">
                      {game.scoreParticipant1} - {game.scoreParticipant2}
                    </div>
                    {game.setScores != null && (
                      <div className="text-xs text-muted-foreground">
                        {formatSetScores(game.setScores as SetScore[])}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="font-mono">- vs -</span>
                )}
              </TableCell>
              <TableCell className="font-medium">
                {game.participant2?.name ?? "TBD"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {game.matchType === "DOUBLES" ? "D" : "S"}
                </Badge>
              </TableCell>
              <TableCell>
                <GameStatusBadge status={game.status} />
              </TableCell>
              <TableCell className="text-xs">
                {game.scheduledAt
                  ? new Date(game.scheduledAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </TableCell>
              <TableCell className="text-xs">
                {game.location?.name ?? "-"}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setScoringGameId(game.id)}
                  >
                    {game.status === "COMPLETE" ? "Edit" : "Score"}
                  </Button>
                  {game.status === "COMPLETE" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => submitReset(game.id)}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ScoreEntryDialog
        open={!!scoringGameId}
        onOpenChange={(open) => {
          if (!open) setScoringGameId(null);
        }}
        onSubmit={(data) => {
          if (scoringGameId) {
            submitScore(scoringGameId, data.setScores);
          }
        }}
        onForfeit={(winnerId) => {
          if (scoringGameId) {
            submitForfeit(scoringGameId, winnerId);
          }
        }}
        team1={scoringGame?.participant1 ?? null}
        team2={scoringGame?.participant2 ?? null}
        scoringConfig={config}
        currentSetScores={scoringGame?.setScores as SetScore[] | null | undefined}
        isPending={isPending}
      />

      <CascadeWarningDialog
        open={!!cascadeInfo}
        onOpenChange={(open) => {
          if (!open) setCascadeInfo(null);
        }}
        onConfirm={confirmCascade}
        downstreamCount={cascadeInfo?.downstreamCount ?? 0}
        scoredCount={cascadeInfo?.scoredCount ?? 0}
        isPending={isPending || isResetPending}
      />
    </>
  );
}
