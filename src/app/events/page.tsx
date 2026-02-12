"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { RacketRulersLogo } from "@/components/racketrulers-logo";
import { PublicEventCard } from "@/components/explore/public-event-card";
import { PublicCoachCard } from "@/components/explore/public-coach-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/loading-state";
import { Search, Trophy, Users } from "lucide-react";

type EventStatus = "all" | "upcoming" | "in-progress" | "completed";

export default function ExplorePage() {
  return (
    <Suspense fallback={<LoadingState variant="centered" />}>
      <ExplorePageContent />
    </Suspense>
  );
}

function ExplorePageContent() {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "coaches" ? "coaches" : "events";

  // Events state
  const [eventSearch, setEventSearch] = useState("");
  const [eventStatus, setEventStatus] = useState<EventStatus>("all");
  const [eventPage, setEventPage] = useState(1);
  const debouncedEventSearch = useDebouncedValue(eventSearch);

  // Coaches state
  const [coachSearch, setCoachSearch] = useState("");
  const [coachPage, setCoachPage] = useState(1);
  const debouncedCoachSearch = useDebouncedValue(coachSearch);

  const { data: eventsData, isLoading: eventsLoading } = useQuery(
    trpc.events.listPublic.queryOptions({
      search: debouncedEventSearch || undefined,
      status: eventStatus,
      page: eventPage,
    })
  );

  const { data: coachesData, isLoading: coachesLoading } = useQuery(
    trpc.coach.listPublic.queryOptions({
      search: debouncedCoachSearch || undefined,
      page: coachPage,
    })
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/">
            <RacketRulersLogo size={36} variant="full" />
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Explore</h1>
          <p className="mt-1 text-muted-foreground">
            Browse upcoming tournaments and find coaches near you
          </p>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="coaches">Coaches</TabsTrigger>
          </TabsList>

          {/* ── Events Tab ── */}
          <TabsContent value="events" className="mt-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={eventSearch}
                  onChange={(e) => {
                    setEventSearch(e.target.value);
                    setEventPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={eventStatus}
                onValueChange={(v) => {
                  setEventStatus(v as EventStatus);
                  setEventPage(1);
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

            {eventsLoading ? (
              <LoadingState text="Loading events..." variant="centered" />
            ) : eventsData && eventsData.events.length > 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {eventsData.events.map((event) => (
                    <PublicEventCard key={event.id} event={event} />
                  ))}
                </div>
                {eventsData.totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={eventPage <= 1}
                      onClick={() => setEventPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {eventsData.currentPage} of {eventsData.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={eventPage >= eventsData.totalPages}
                      onClick={() => setEventPage((p) => p + 1)}
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
                  No events found
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── Coaches Tab ── */}
          <TabsContent value="coaches" className="mt-6">
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search coaches..."
                  value={coachSearch}
                  onChange={(e) => {
                    setCoachSearch(e.target.value);
                    setCoachPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {coachesLoading ? (
              <LoadingState text="Loading coaches..." variant="centered" />
            ) : coachesData && coachesData.coaches.length > 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {coachesData.coaches.map((coach) => (
                    <PublicCoachCard key={coach.id} coach={coach} />
                  ))}
                </div>
                {coachesData.totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={coachPage <= 1}
                      onClick={() => setCoachPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {coachesData.currentPage} of {coachesData.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={coachPage >= coachesData.totalPages}
                      onClick={() => setCoachPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Users className="h-12 w-12 text-muted-foreground/40" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No coaches found
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
