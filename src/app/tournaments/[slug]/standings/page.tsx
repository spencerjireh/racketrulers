import { getTournamentBySlug } from "@/lib/tournament-loader";
import { PublicStandingsView } from "@/components/public/standings-view";

export default async function PublicStandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);

  return <PublicStandingsView tournamentId={tournament.id} />;
}
