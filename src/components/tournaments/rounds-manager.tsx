"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RoundFormDialog } from "./round-form-dialog";
import { PoolManager } from "./pool-manager";
import { GamesList } from "./games-list";
import { StandingsTable } from "./standings-table";

interface RoundsManagerProps {
  tournamentId: string;
}

export function RoundsManager({ tournamentId }: RoundsManagerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const [expandedRound, setExpandedRound] = usePersistedState<string | null>(
    `collapsible:rounds:${tournamentId}`,
    null
  );

  const { data: rounds } = useQuery(
    trpc.rounds.list.queryOptions({ tournamentId })
  );

  const createRound = useMutation(
    trpc.rounds.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.rounds.list.queryFilter({ tournamentId })
        );
        setShowForm(false);
        toast.success("Round created");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteRound = useMutation(
    trpc.rounds.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.rounds.list.queryFilter({ tournamentId })
        );
        toast.success("Round deleted");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const generateGames = useMutation(
    trpc.rounds.generateGames.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries(
          trpc.rounds.list.queryFilter({ tournamentId })
        );
        queryClient.invalidateQueries({
          queryKey: [["games", "listByRound"]],
        });
        toast.success(`Generated ${result.gamesCreated} games`);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const clearGames = useMutation(
    trpc.rounds.clearGames.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.rounds.list.queryFilter({ tournamentId })
        );
        queryClient.invalidateQueries({
          queryKey: [["games", "listByRound"]],
        });
        toast.success("Games cleared");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Rounds</h4>
        <Button size="sm" onClick={() => setShowForm(true)}>
          Add Round
        </Button>
      </div>

      {rounds && rounds.length > 0 ? (
        <div className="space-y-2">
          {rounds.map((round) => (
            <RoundCard
              key={round.id}
              round={round}
              tournamentId={tournamentId}
              expanded={expandedRound === round.id}
              onToggle={(open) =>
                setExpandedRound(open ? round.id : null)
              }
              onDelete={() => {
                setConfirmAction({
                  title: `Delete "${round.name}"?`,
                  description: "This will delete all pools and games in this round. This cannot be undone.",
                  onConfirm: () => {
                    deleteRound.mutate({ id: round.id, tournamentId });
                    setConfirmAction(null);
                  },
                });
              }}
              onGenerate={() =>
                generateGames.mutate({ id: round.id, tournamentId })
              }
              onClear={() => {
                setConfirmAction({
                  title: "Clear all games?",
                  description: "All games in this round will be deleted. This cannot be undone.",
                  onConfirm: () => {
                    clearGames.mutate({ id: round.id, tournamentId });
                    setConfirmAction(null);
                  },
                });
              }}
              isGenerating={generateGames.isPending}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No rounds yet. Create a round to set up pools and games.
        </p>
      )}

      <RoundFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={(data) =>
          createRound.mutate({ tournamentId, ...data })
        }
        isPending={createRound.isPending}
      />

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction?.onConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoundCard({
  round,
  tournamentId,
  expanded,
  onToggle,
  onDelete,
  onGenerate,
  onClear,
  isGenerating,
}: {
  round: {
    id: string;
    name: string;
    type: string;
    _count: { pools: number; games: number };
  };
  tournamentId: string;
  expanded: boolean;
  onToggle: (open: boolean) => void;
  onDelete: () => void;
  onGenerate: () => void;
  onClear: () => void;
  isGenerating: boolean;
}) {
  const trpc = useTRPC();

  const { data: games } = useQuery({
    ...trpc.games.listByRound.queryOptions({ roundId: round.id, tournamentId }),
    enabled: expanded,
  });

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <div className="rounded border">
        <div className="flex items-center justify-between p-2">
          <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="font-medium text-sm">{round.name}</span>
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {round.type.replace("_", " ")}
            </span>
            <span className="text-xs text-muted-foreground">
              {round._count.games} game(s)
            </span>
          </CollapsibleTrigger>
          <div className="flex gap-1">
            {round._count.games === 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "Generate Games"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onClear}
              >
                Clear Games
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive"
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          <div className="border-t p-3 space-y-4">
            {round.type === "ROUND_ROBIN" && (
              <PoolManager roundId={round.id} tournamentId={tournamentId} />
            )}
            {games && games.length > 0 && (
              <>
                <GamesList
                  games={games}
                  tournamentId={tournamentId}
                  showPool={round.type === "ROUND_ROBIN"}
                />
                {round.type === "ROUND_ROBIN" && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Standings</h4>
                    <StandingsTable roundId={round.id} />
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
