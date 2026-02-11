"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { GameStatusBadge } from "./game-status-badge";
import { ScoreEntryDialog } from "./score-entry-dialog";

interface Game {
  id: string;
  status: string;
  roundPosition: number | null;
  scheduledAt: string | Date | null;
  scoreTeam1: number | null;
  scoreTeam2: number | null;
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  pool: { id: string; name: string } | null;
}

interface GamesListProps {
  games: Game[];
  eventId: string;
  showPool?: boolean;
}

export function GamesList({ games, eventId, showPool = false }: GamesListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [scoringGame, setScoringGame] = useState<Game | null>(null);

  const invalidateGames = () => {
    queryClient.invalidateQueries(
      trpc.games.listByEvent.queryFilter({ eventId })
    );
    queryClient.invalidateQueries({
      queryKey: [["games", "listByRound"]],
    });
    queryClient.invalidateQueries({
      queryKey: [["games", "getStandings"]],
    });
  };

  const updateScore = useMutation(
    trpc.games.updateScore.mutationOptions({
      onSuccess: () => {
        invalidateGames();
        setScoringGame(null);
        toast.success("Score saved");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateStatus = useMutation(
    trpc.games.updateStatus.mutationOptions({
      onSuccess: () => {
        invalidateGames();
        setScoringGame(null);
        toast.success("Status updated");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const resetScore = useMutation(
    trpc.games.resetScore.mutationOptions({
      onSuccess: () => {
        invalidateGames();
        toast.success("Score reset");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (games.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No games to display.</p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            {showPool && <TableHead>Pool</TableHead>}
            <TableHead>Team 1</TableHead>
            <TableHead className="text-center w-24">Score</TableHead>
            <TableHead>Team 2</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {games.map((game) => (
            <TableRow key={game.id}>
              <TableCell className="text-muted-foreground text-xs">
                {game.roundPosition}
              </TableCell>
              {showPool && (
                <TableCell className="text-xs">
                  {game.pool?.name ?? "-"}
                </TableCell>
              )}
              <TableCell className="font-medium">
                {game.team1?.name ?? "TBD"}
              </TableCell>
              <TableCell className="text-center font-mono">
                {game.scoreTeam1 !== null && game.scoreTeam2 !== null
                  ? `${game.scoreTeam1} - ${game.scoreTeam2}`
                  : "- vs -"}
              </TableCell>
              <TableCell className="font-medium">
                {game.team2?.name ?? "TBD"}
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
                    onClick={() => setScoringGame(game)}
                  >
                    Score
                  </Button>
                  {game.status === "COMPLETED" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        resetScore.mutate({ id: game.id, eventId })
                      }
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
        open={!!scoringGame}
        onOpenChange={(open) => {
          if (!open) setScoringGame(null);
        }}
        onSubmit={(scores) => {
          if (scoringGame) {
            updateScore.mutate({ id: scoringGame.id, eventId, ...scores });
          }
        }}
        onForfeit={(winnerId) => {
          if (scoringGame) {
            updateStatus.mutate({
              id: scoringGame.id,
              eventId,
              status: "FORFEIT",
              forfeitWinnerId: winnerId,
            });
          }
        }}
        onCancel={() => {
          if (scoringGame) {
            updateStatus.mutate({
              id: scoringGame.id,
              eventId,
              status: "CANCELLED",
            });
          }
        }}
        team1={scoringGame?.team1 ?? null}
        team2={scoringGame?.team2 ?? null}
        currentScore={
          scoringGame
            ? {
                scoreTeam1: scoringGame.scoreTeam1,
                scoreTeam2: scoringGame.scoreTeam2,
              }
            : undefined
        }
        isPending={updateScore.isPending || updateStatus.isPending}
      />
    </>
  );
}
