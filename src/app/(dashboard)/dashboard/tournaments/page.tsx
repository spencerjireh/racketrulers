"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { LoadingState } from "@/components/ui/loading-state";

export default function TournamentsPage() {
  const trpc = useTRPC();
  const { data: tournaments, isLoading } = useQuery(
    trpc.tournaments.list.queryOptions()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Tournaments</h1>
          <p className="text-muted-foreground">
            Create and manage your tournaments
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/tournaments/new">Create Tournament</Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingState text="Loading tournaments..." />
      ) : tournaments && tournaments.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No tournaments yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first tournament to get started
            </p>
            <Button className="mt-4" asChild>
              <Link href="/dashboard/tournaments/new">Create Tournament</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
