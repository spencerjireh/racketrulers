"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { EventCard } from "@/components/events/event-card";
import { LoadingState } from "@/components/ui/loading-state";

export default function EventsPage() {
  const trpc = useTRPC();
  const { data: events, isLoading } = useQuery(trpc.events.list.queryOptions());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Events</h1>
          <p className="text-muted-foreground">
            Create and manage your tournaments
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/events/new">Create Event</Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingState text="Loading events..." />
      ) : events && events.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No events yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first tournament to get started
            </p>
            <Button className="mt-4" asChild>
              <Link href="/dashboard/events/new">Create Event</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
