import { createServerCaller } from "@/lib/trpc/server";
import { PublicScheduleView } from "@/components/public/schedule-view";
import { PublicBracketClient } from "./bracket-client";

export default async function PublicBracketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const caller = await createServerCaller();
  const tournament = await caller.tournaments.getBySlug({ slug });

  // Find single-elim round with games
  const singleElimRound = tournament.rounds.find(
    (r) => r.type === "SINGLE_ELIM" && r._count.games > 0
  );

  if (singleElimRound) {
    return (
      <PublicBracketClient
        tournamentId={tournament.id}
        roundId={singleElimRound.id}
      />
    );
  }

  return <PublicScheduleView tournamentId={tournament.id} />;
}
