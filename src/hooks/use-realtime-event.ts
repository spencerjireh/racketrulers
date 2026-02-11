"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useSocket } from "./use-socket";

export function useRealtimeEvent(eventId: string) {
  const { on } = useSocket(eventId);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  useEffect(() => {
    const unsub1 = on("score:updated", () => {
      queryClient.invalidateQueries(
        trpc.games.listByEvent.queryFilter({ eventId })
      );
      queryClient.invalidateQueries(
        trpc.games.listByEventPublic.queryFilter({ eventId })
      );
      // Invalidate all standings queries (any roundId)
      queryClient.invalidateQueries({ queryKey: [["games", "getStandings"]] });
    });

    const unsub2 = on("schedule:updated", () => {
      queryClient.invalidateQueries(
        trpc.games.listByEvent.queryFilter({ eventId })
      );
      queryClient.invalidateQueries(
        trpc.games.listByEventPublic.queryFilter({ eventId })
      );
    });

    const unsub3 = on("event:updated", () => {
      queryClient.invalidateQueries({
        queryKey: [["events", "getBySlug"]],
      });
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [on, queryClient, trpc, eventId]);
}
