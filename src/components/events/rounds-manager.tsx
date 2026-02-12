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
import { RoundFormDialog } from "./round-form-dialog";
import { PoolManager } from "./pool-manager";
import { GamesList } from "./games-list";
import { StandingsTable } from "./standings-table";

interface RoundsManagerProps {
  categoryId: string;
  eventId: string;
}

export function RoundsManager({ categoryId, eventId }: RoundsManagerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedRound, setExpandedRound] = usePersistedState<string | null>(
    `collapsible:rounds:${categoryId}`,
    null
  );

  const { data: rounds } = useQuery(
    trpc.rounds.list.queryOptions({ categoryId, eventId })
  );

  const createRound = useMutation(
    trpc.rounds.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.rounds.list.queryFilter({ categoryId, eventId })
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
          trpc.rounds.list.queryFilter({ categoryId, eventId })
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
          trpc.rounds.list.queryFilter({ categoryId, eventId })
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
          trpc.rounds.list.queryFilter({ categoryId, eventId })
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
              eventId={eventId}
              expanded={expandedRound === round.id}
              onToggle={(open) =>
                setExpandedRound(open ? round.id : null)
              }
              onDelete={() => {
                if (
                  confirm(
                    `Delete round "${round.name}"? This will delete all pools and games.`
                  )
                ) {
                  deleteRound.mutate({ id: round.id, eventId });
                }
              }}
              onGenerate={() =>
                generateGames.mutate({ id: round.id, eventId })
              }
              onClear={() => {
                if (
                  confirm("Clear all games in this round?")
                ) {
                  clearGames.mutate({ id: round.id, eventId });
                }
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
          createRound.mutate({ categoryId, eventId, ...data })
        }
        isPending={createRound.isPending}
      />
    </div>
  );
}

function RoundCard({
  round,
  eventId,
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
  eventId: string;
  expanded: boolean;
  onToggle: (open: boolean) => void;
  onDelete: () => void;
  onGenerate: () => void;
  onClear: () => void;
  isGenerating: boolean;
}) {
  const trpc = useTRPC();

  const { data: games } = useQuery({
    ...trpc.games.listByRound.queryOptions({ roundId: round.id, eventId }),
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
              <PoolManager roundId={round.id} eventId={eventId} />
            )}
            {games && games.length > 0 && (
              <>
                <GamesList
                  games={games}
                  eventId={eventId}
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
