"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { StandingsTable } from "@/components/events/standings-table";

interface StandingsViewProps {
  eventId: string;
  categories: {
    id: string;
    name: string;
    rounds: {
      id: string;
      name: string;
      type: string;
      pools: { id: string; name: string }[];
    }[];
  }[];
}

export function PublicStandingsView({ categories }: StandingsViewProps) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No standings available.</p>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <div key={cat.id} className="space-y-3">
          <h2 className="text-lg font-semibold">{cat.name}</h2>
          {cat.rounds
            .filter((r) => r.type === "ROUND_ROBIN")
            .map((round) => (
              <div key={round.id} className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {round.name}
                </h3>
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
      ))}
    </div>
  );
}
