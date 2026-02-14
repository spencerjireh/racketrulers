"use client";

import { StandingsTable } from "@/components/tournaments/standings-table";

interface StandingsViewProps {
  rounds: {
    id: string;
    name: string;
    type: string;
    pools: { id: string; name: string }[];
  }[];
}

export function PublicStandingsView({ rounds }: StandingsViewProps) {
  if (rounds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No standings available.</p>
    );
  }

  return (
    <div className="space-y-6">
      {rounds
        .filter((r) => r.type === "ROUND_ROBIN")
        .map((round) => (
          <div key={round.id} className="space-y-2">
            <h2 className="text-lg font-semibold">{round.name}</h2>
            {round.pools.length > 0 ? (
              round.pools.map((pool) => (
                <StandingsTable
                  key={pool.id}
                  roundId={round.id}
                  poolId={pool.id}
                  title={pool.name}
                />
              ))
            ) : (
              <StandingsTable roundId={round.id} />
            )}
          </div>
        ))}
    </div>
  );
}
