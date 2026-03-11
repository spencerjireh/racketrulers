"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PublicTournamentCard } from "@/components/explore/public-tournament-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { Search, Trophy } from "lucide-react";

type TournamentStatus = "all" | "upcoming" | "in-progress" | "completed";

export default function ExplorePage() {
  const trpc = useTRPC();

  const [tournamentSearch, setTournamentSearch] = useState("");
  const [tournamentStatus, setTournamentStatus] = useState<TournamentStatus>("all");
  const [tournamentPage, setTournamentPage] = useState(1);
  const debouncedTournamentSearch = useDebouncedValue(tournamentSearch);

  const { data: tournamentsData, isLoading: tournamentsLoading } = useQuery(
    trpc.tournaments.listPublic.queryOptions({
      search: debouncedTournamentSearch || undefined,
      status: tournamentStatus,
      page: tournamentPage,
    })
  );

  return (
    <main className="mx-auto max-w-6xl py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Explore</h1>
        <p className="mt-1 text-muted-foreground">
          Browse upcoming tournaments
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tournaments..."
            value={tournamentSearch}
            onChange={(e) => {
              setTournamentSearch(e.target.value);
              setTournamentPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={tournamentStatus}
          onValueChange={(v) => {
            setTournamentStatus(v as TournamentStatus);
            setTournamentPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tournamentsLoading ? (
        <LoadingState text="Loading tournaments..." variant="centered" />
      ) : tournamentsData && tournamentsData.tournaments.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournamentsData.tournaments.map((tournament) => (
              <PublicTournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
          {tournamentsData.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={tournamentPage <= 1}
                onClick={() => setTournamentPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {tournamentsData.currentPage} of {tournamentsData.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={tournamentPage >= tournamentsData.totalPages}
                onClick={() => setTournamentPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <Trophy className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">
            No tournaments found
          </p>
        </div>
      )}
    </main>
  );
}
