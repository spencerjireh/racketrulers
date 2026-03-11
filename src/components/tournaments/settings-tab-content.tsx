"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { TournamentSettingsForm } from "./tournament-settings-form";
import { PointsConfigForm } from "./points-config-form";
import { LocationsManager } from "./locations-manager";
import { DeleteTournamentDialog } from "./delete-tournament-dialog";
import { ResetTournamentDialog } from "./reset-tournament-dialog";
import { LoadingState } from "@/components/ui/loading-state";

export function SettingsTabContent({ tournamentId }: { tournamentId: string }) {
  const trpc = useTRPC();
  const { data: tournament, isLoading } = useQuery(
    trpc.tournaments.getById.queryOptions({ id: tournamentId })
  );

  if (isLoading) return <LoadingState text="Loading settings..." />;
  if (!tournament) return <p className="text-sm text-muted-foreground">Tournament not found.</p>;

  const isCompleted = tournament.status === "COMPLETE";
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
        <div className="space-y-4">
          {(tournament.status === "UNDERWAY" || tournament.status === "COMPLETE") && (
            <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
              <div>
                <p className="text-sm font-medium">Reset Tournament</p>
                <p className="text-sm text-muted-foreground">
                  Delete all matches and return to pending. Participants are preserved.
                </p>
              </div>
              <ResetTournamentDialog
                tournamentId={tournamentId}
                slug={tournament.slug}
                variant="danger-zone"
              />
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
            <div>
              <p className="text-sm font-medium">Delete Tournament</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete this tournament and all associated data.
              </p>
            </div>
            <DeleteTournamentDialog tournamentId={tournamentId} />
          </div>
        </div>
      </section>
    </div>
  );
}
