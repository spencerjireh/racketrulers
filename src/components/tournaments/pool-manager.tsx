"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface PoolManagerProps {
  roundId: string;
  tournamentId: string;
}

export function PoolManager({ roundId, tournamentId }: PoolManagerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [newPoolName, setNewPoolName] = useState("");
  const [poolCount, setPoolCount] = useState(2);

  const { data: pools } = useQuery(
    trpc.pools.list.queryOptions({ roundId, tournamentId })
  );

  const invalidatePools = () => {
    queryClient.invalidateQueries(
      trpc.pools.list.queryFilter({ roundId, tournamentId })
    );
    queryClient.invalidateQueries(
      trpc.rounds.getById.queryFilter({ id: roundId, tournamentId })
    );
  };

  const createPool = useMutation(
    trpc.pools.create.mutationOptions({
      onSuccess: () => {
        invalidatePools();
        setNewPoolName("");
        toast.success("Pool created");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deletePool = useMutation(
    trpc.pools.delete.mutationOptions({
      onSuccess: () => {
        invalidatePools();
        toast.success("Pool deleted");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const assignTeam = useMutation(
    trpc.pools.assignTeam.mutationOptions({
      onSuccess: () => {
        invalidatePools();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const removeTeam = useMutation(
    trpc.pools.removeTeam.mutationOptions({
      onSuccess: () => {
        invalidatePools();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const autoAssign = useMutation(
    trpc.pools.autoAssign.mutationOptions({
      onSuccess: (result) => {
        invalidatePools();
        toast.success(
          `Created ${result.poolsCreated} pools with ${result.teamsAssigned} teams`
        );
      },
      onError: (err) => toast.error(err.message),
    })
  );

  // Get all pool team IDs to find unassigned teams
  const assignedTeamIds = new Set(
    pools?.flatMap((p) => p.poolTeams.map((pt) => pt.teamId)) ?? []
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Pool name"
          value={newPoolName}
          onChange={(e) => setNewPoolName(e.target.value)}
          className="max-w-[200px]"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (newPoolName.trim()) {
              createPool.mutate({
                roundId,
                tournamentId,
                name: newPoolName.trim(),
              });
            }
          }}
          disabled={createPool.isPending}
        >
          Add Pool
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={16}
            value={poolCount}
            onChange={(e) => setPoolCount(parseInt(e.target.value) || 2)}
            className="w-16"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => autoAssign.mutate({ roundId, tournamentId, poolCount })}
            disabled={autoAssign.isPending}
          >
            Auto-Assign Pools
          </Button>
        </div>
      </div>

      {pools && pools.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {pools.map((pool) => (
            <Card key={pool.id}>
              <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{pool.name}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-destructive"
                  onClick={() => deletePool.mutate({ id: pool.id, tournamentId })}
                >
                  Delete
                </Button>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {pool.poolTeams.length > 0 ? (
                  <div className="space-y-1">
                    {pool.poolTeams.map((pt) => (
                      <div
                        key={pt.teamId}
                        className="flex items-center justify-between text-sm rounded border px-2 py-1"
                      >
                        <span>
                          <span className="text-xs text-muted-foreground mr-1">
                            #{pt.seed || "-"}
                          </span>
                          {pt.team.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-xs text-destructive"
                          onClick={() =>
                            removeTeam.mutate({
                              poolId: pool.id,
                              tournamentId,
                              teamId: pt.teamId,
                            })
                          }
                        >
                          x
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No teams in this pool
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
