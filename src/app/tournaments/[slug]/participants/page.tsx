import { auth } from "@/lib/auth";
import { getTournamentBySlug } from "@/lib/tournament-loader";
import { TeamsManager } from "@/components/tournaments/teams-manager";
import { PublicParticipantsView } from "@/components/public/public-participants-view";

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, tournament] = await Promise.all([auth(), getTournamentBySlug(slug)]);

  const isOwner = session?.user?.id === tournament.ownerId;

  if (isOwner) {
    return <TeamsManager tournamentId={tournament.id} />;
  }

  return <PublicParticipantsView tournamentId={tournament.id} />;
}
