import { createServerCaller } from "@/lib/trpc/server";
import { PublicStandingsView } from "@/components/public/standings-view";

export default async function PublicStandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const caller = await createServerCaller();
  const tournament = await caller.tournaments.getBySlug({ slug });

  return <PublicStandingsView tournamentId={tournament.id} />;
}
