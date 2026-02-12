"use client";

import { use } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EventSettingsForm } from "@/components/events/event-settings-form";
import { PointsConfigForm } from "@/components/events/points-config-form";
import { DeleteEventDialog } from "@/components/events/delete-event-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: event, isLoading } = useQuery(
    trpc.events.getById.queryOptions({ id })
  );

  const completeEvent = useMutation(
    trpc.events.complete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.events.getById.queryFilter({ id }));
        queryClient.invalidateQueries(trpc.events.getStats.queryFilter());
        toast.success("Event marked as completed");
      },
    })
  );

  const reopenEvent = useMutation(
    trpc.events.reopen.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.events.getById.queryFilter({ id }));
        queryClient.invalidateQueries(trpc.events.getStats.queryFilter());
        toast.success("Event reopened");
      },
    })
  );

  if (isLoading || !event) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  const pointsConfig = event.pointsConfig as {
    win: number;
    draw: number;
    loss: number;
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Event Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <EventSettingsForm event={{
            ...event,
            scoringConfig: event.scoringConfig as { pointsPerSet: number; totalSets: number; deuceEnabled: boolean; maxPoints: number } | undefined,
          }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Points Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <PointsConfigForm
            eventId={event.id}
            pointsConfig={pointsConfig}
            disabled={event.status === "COMPLETED"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status & Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Current status:{" "}
              <span className="font-medium text-foreground">
                {event.status}
              </span>
            </p>
            {event.status === "PUBLISHED" ? (
              <Button
                variant="outline"
                onClick={() => completeEvent.mutate({ id })}
                disabled={completeEvent.isPending}
              >
                {completeEvent.isPending ? "Completing..." : "Complete Event"}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => reopenEvent.mutate({ id })}
                disabled={reopenEvent.isPending}
              >
                {reopenEvent.isPending ? "Reopening..." : "Reopen Event"}
              </Button>
            )}
          </div>

          <Separator />

          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete this event and all its data.
            </p>
            <DeleteEventDialog eventId={event.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
