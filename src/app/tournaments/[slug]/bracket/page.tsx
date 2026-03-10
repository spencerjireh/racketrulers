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

  const isBracketFormat =
    tournament.format === "SINGLE_ELIM" || tournament.format === "DOUBLE_ELIM";

  if (isBracketFormat && tournament.status !== "PENDING") {
    return <PublicBracketClient tournamentId={tournament.id} />;
  }

  return <PublicScheduleView tournamentId={tournament.id} />;
}
