"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RoundsManager } from "./rounds-manager";
import { GamesList } from "./games-list";
import { useRealtimeEvent } from "@/hooks/use-realtime-event";

export function ScheduleView({ eventId }: { eventId: string }) {
  const trpc = useTRPC();
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  useRealtimeEvent(eventId);

  const { data: categories, isLoading: catsLoading } = useQuery(
    trpc.categories.list.queryOptions({ eventId })
  );

  const { data: allGames } = useQuery(
    trpc.games.listByEvent.queryOptions({ eventId })
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>All Games</CardTitle>
        </CardHeader>
        <CardContent>
          {allGames && allGames.length > 0 ? (
            <GamesList games={allGames} eventId={eventId} showPool />
          ) : (
            <p className="text-sm text-muted-foreground">
              No games generated yet. Create categories, assign teams, add
              rounds, and generate games.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {catsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : categories && categories.length > 0 ? (
            <div className="space-y-2">
              {categories.map((cat) => (
                <Collapsible
                  key={cat.id}
                  open={expandedCat === cat.id}
                  onOpenChange={(open) =>
                    setExpandedCat(open ? cat.id : null)
                  }
                >
                  <div className="rounded border">
                    <CollapsibleTrigger className="flex w-full items-center gap-2 p-3 cursor-pointer">
                      {expandedCat === cat.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{cat.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {cat._count.rounds} round(s), {cat._count.categoryTeams}{" "}
                        team(s)
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t p-3">
                        <RoundsManager
                          categoryId={cat.id}
                          eventId={eventId}
                        />
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No categories yet. Add categories in the Categories tab first.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
