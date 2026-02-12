"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";

interface ReviewStepProps {
  eventId: string;
}

export function ReviewStep({ eventId }: ReviewStepProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: event } = useQuery(
    trpc.events.getById.queryOptions({ id: eventId })
  );
  const { data: categories } = useQuery(
    trpc.categories.list.queryOptions({ eventId })
  );
  const { data: allGames } = useQuery(
    trpc.games.listByEvent.queryOptions({ eventId })
  );
  const { data: teams } = useQuery(
    trpc.teams.list.queryOptions({ eventId })
  );

  const publishEvent = useMutation(
    trpc.events.publish.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.events.getById.queryFilter({ id: eventId }));
        queryClient.invalidateQueries(trpc.events.getStats.queryFilter());
        toast.success("Event published successfully");
        router.push(`/dashboard/events/${eventId}/manage/scores`);
        router.refresh();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (!event) {
    return <LoadingState />;
  }

  const categoryCount = categories?.length ?? 0;
  const teamCount = teams?.length ?? 0;
  const gameCount = allGames?.length ?? 0;
  const scheduledCount = allGames?.filter((g) => g.scheduledAt).length ?? 0;
  const unscheduledCount = gameCount - scheduledCount;

  const scoringConfig = event.scoringConfig as {
    pointsPerSet: number;
    totalSets: number;
    deuceEnabled: boolean;
    maxPoints: number;
  };
  const pointsConfig = event.pointsConfig as {
    win: number;
    draw: number;
    loss: number;
  };

  const checks = [
    {
      label: "Event has at least 1 category",
      passed: categoryCount >= 1,
    },
    {
      label: "Event has at least 2 teams",
      passed: teamCount >= 2,
    },
    {
      label: "Games have been generated",
      passed: gameCount > 0,
    },
    {
      label: "All games are scheduled",
      passed: unscheduledCount === 0 && gameCount > 0,
      warning: true,
    },
  ];

  const canPublish = checks
    .filter((c) => !c.warning)
    .every((c) => c.passed);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Event Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium mb-1">Event Details</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Name: {event.name}</p>
                <p>
                  Dates: {new Date(event.startDate).toLocaleDateString()} -{" "}
                  {new Date(event.endDate).toLocaleDateString()}
                </p>
                <p>Timezone: {event.timezone}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1">Format</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{categoryCount} categor{categoryCount === 1 ? "y" : "ies"}</p>
                {categories?.map((cat) => (
                  <p key={cat.id} className="pl-2">
                    - {cat.name} ({cat._count.rounds} round{cat._count.rounds !== 1 ? "s" : ""})
                  </p>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1">Teams</h4>
              <p className="text-sm text-muted-foreground">
                {teamCount} team{teamCount !== 1 ? "s" : ""} registered
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1">Schedule</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{gameCount} total game{gameCount !== 1 ? "s" : ""}</p>
                <p>{scheduledCount} scheduled, {unscheduledCount} unscheduled</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1">Scoring</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Best of {scoringConfig?.totalSets ?? 3}, {scoringConfig?.pointsPerSet ?? 21} points/set</p>
                <p>Win: {pointsConfig.win}pts, Draw: {pointsConfig.draw}pts, Loss: {pointsConfig.loss}pts</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pre-publish Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checks.map((check, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span
                  className={
                    check.passed
                      ? "text-green-600"
                      : check.warning
                        ? "text-yellow-600"
                        : "text-destructive"
                  }
                >
                  {check.passed ? "[x]" : check.warning ? "[!]" : "[ ]"}
                </span>
                <span
                  className={
                    !check.passed && !check.warning
                      ? "text-destructive"
                      : ""
                  }
                >
                  {check.label}
                  {!check.passed && check.warning && " (optional)"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={() => publishEvent.mutate({ id: eventId })}
          disabled={!canPublish || publishEvent.isPending}
        >
          {publishEvent.isPending ? "Publishing..." : "Publish Event"}
        </Button>
      </div>
    </div>
  );
}
