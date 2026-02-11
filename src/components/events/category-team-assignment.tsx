"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";

interface CategoryTeamAssignmentProps {
  categoryId: string;
  eventId: string;
}

export function CategoryTeamAssignment({
  categoryId,
  eventId,
}: CategoryTeamAssignmentProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [editingSeed, setEditingSeed] = useState<{
    teamId: string;
    seed: number;
  } | null>(null);

  const { data: category } = useQuery(
    trpc.categories.getById.queryOptions({ id: categoryId, eventId })
  );

  const { data: allTeams } = useQuery(
    trpc.teams.list.queryOptions({ eventId })
  );

  const assignTeam = useMutation(
    trpc.categories.assignTeam.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.categories.getById.queryFilter({ id: categoryId, eventId })
        );
        queryClient.invalidateQueries(
          trpc.categories.list.queryFilter({ eventId })
        );
        toast.success("Team assigned");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const removeTeam = useMutation(
    trpc.categories.removeTeam.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.categories.getById.queryFilter({ id: categoryId, eventId })
        );
        queryClient.invalidateQueries(
          trpc.categories.list.queryFilter({ eventId })
        );
        toast.success("Team removed");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateSeed = useMutation(
    trpc.categories.updateSeed.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.categories.getById.queryFilter({ id: categoryId, eventId })
        );
        setEditingSeed(null);
        toast.success("Seed updated");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const randomizeSeeds = useMutation(
    trpc.categories.randomizeSeeds.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.categories.getById.queryFilter({ id: categoryId, eventId })
        );
        toast.success("Seeds randomized");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const assignedTeamIds = new Set(
    category?.categoryTeams.map((ct) => ct.teamId) ?? []
  );
  const availableTeams =
    allTeams?.filter((t) => !assignedTeamIds.has(t.id)) ?? [];

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium mb-2">
            Assigned ({category?.categoryTeams.length ?? 0})
          </h4>
          {category?.categoryTeams.length ? (
            <div className="space-y-1">
              {category.categoryTeams.map((ct) => (
                <div
                  key={ct.teamId}
                  className="flex items-center gap-2 rounded border p-2 text-sm"
                >
                  {editingSeed?.teamId === ct.teamId ? (
                    <Input
                      type="number"
                      className="w-16 h-7"
                      value={editingSeed.seed}
                      min={0}
                      onChange={(e) =>
                        setEditingSeed({
                          teamId: ct.teamId,
                          seed: parseInt(e.target.value) || 0,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updateSeed.mutate({
                            categoryId,
                            eventId,
                            teamId: ct.teamId,
                            seed: editingSeed.seed,
                          });
                        }
                        if (e.key === "Escape") setEditingSeed(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      className="w-8 text-center text-xs bg-muted rounded px-1 py-0.5 cursor-pointer"
                      onClick={() =>
                        setEditingSeed({ teamId: ct.teamId, seed: ct.seed })
                      }
                      title="Click to edit seed"
                    >
                      #{ct.seed || "-"}
                    </button>
                  )}
                  <span className="flex-1">{ct.team.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive"
                    onClick={() =>
                      removeTeam.mutate({ categoryId, eventId, teamId: ct.teamId })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => randomizeSeeds.mutate({ categoryId, eventId })}
                disabled={randomizeSeeds.isPending}
              >
                Randomize Seeds
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No teams assigned</p>
          )}
        </div>
        <div>
          <h4 className="text-sm font-medium mb-2">
            Available ({availableTeams.length})
          </h4>
          {availableTeams.length > 0 ? (
            <div className="space-y-1">
              {availableTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>{team.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() =>
                      assignTeam.mutate({ categoryId, eventId, teamId: team.id })
                    }
                  >
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              All teams are assigned
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
