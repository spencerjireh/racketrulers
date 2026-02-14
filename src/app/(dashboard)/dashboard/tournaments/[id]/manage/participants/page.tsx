"use client";

import { use } from "react";
import { TeamsManager } from "@/components/tournaments/teams-manager";

export default function TournamentParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = use(params);

  return (
    <div className="space-y-6">
      <TeamsManager tournamentId={tournamentId} />
    </div>
  );
}
