"use client";

import { use } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { TournamentSettingsForm } from "@/components/tournaments/tournament-settings-form";
import { PointsConfigForm } from "@/components/tournaments/points-config-form";
import { LocationsManager } from "@/components/tournaments/locations-manager";
import { DeleteTournamentDialog } from "@/components/tournaments/delete-tournament-dialog";
import { LoadingState } from "@/components/ui/loading-state";

export default function TournamentSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = use(params);
  const trpc = useTRPC();

  const { data: tournament, isLoading } = useQuery(
    trpc.tournaments.getById.queryOptions({ id: tournamentId })
  );

  if (isLoading) {
    return <LoadingState text="Loading settings..." />;
  }

  if (!tournament) {
    return <p className="text-sm text-muted-foreground">Tournament not found.</p>;
  }

  const isCompleted = tournament.status === "COMPLETED";
  const pointsConfig = (tournament.pointsConfig as { win: number; draw: number; loss: number } | null) ?? {
    win: 3,
    draw: 1,
    loss: 0,
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-4">Tournament Details</h2>
        <TournamentSettingsForm tournament={tournament} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Points Configuration</h2>
        <PointsConfigForm
          tournamentId={tournamentId}
          pointsConfig={pointsConfig}
          disabled={isCompleted}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Courts</h2>
        <LocationsManager tournamentId={tournamentId} />
      </section>

      <section className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-4 text-destructive">Danger Zone</h2>
        <DeleteTournamentDialog tournamentId={tournamentId} />
      </section>
    </div>
  );
}
