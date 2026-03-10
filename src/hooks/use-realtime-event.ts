"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useSocket } from "./use-socket";

export function useRealtimeTournament(tournamentId: string) {
  const { on } = useSocket(tournamentId);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  useEffect(() => {
    const unsub1 = on("score:updated", () => {
      queryClient.invalidateQueries(
        trpc.matches.listByTournament.queryFilter({ tournamentId })
      );
      queryClient.invalidateQueries(
        trpc.matches.listByTournamentPublic.queryFilter({ tournamentId })
      );
      // Invalidate all standings queries (any tournamentId)
      queryClient.invalidateQueries({ queryKey: [["matches", "getStandings"]] });
      // Invalidate bracket data queries
      queryClient.invalidateQueries({ queryKey: [["matches", "getBracketData"]] });
      queryClient.invalidateQueries({ queryKey: [["matches", "getBracketDataPublic"]] });
    });

    const unsub2 = on("schedule:updated", () => {
      queryClient.invalidateQueries(
        trpc.matches.listByTournament.queryFilter({ tournamentId })
      );
      queryClient.invalidateQueries(
        trpc.matches.listByTournamentPublic.queryFilter({ tournamentId })
      );
    });

    const unsub3 = on("tournament:updated", () => {
      queryClient.invalidateQueries({
        queryKey: [["tournaments", "getBySlug"]],
      });
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [on, queryClient, trpc, tournamentId]);
}
