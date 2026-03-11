import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { TeamsManager } from "@/components/tournaments/teams-manager";
import { PublicParticipantsView } from "@/components/public/public-participants-view";

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, caller] = await Promise.all([auth(), createServerCaller()]);
  const tournament = await caller.tournaments.getBySlug({ slug });

  const isOwner = session?.user?.id === tournament.ownerId;

  if (isOwner) {
    return <TeamsManager tournamentId={tournament.id} />;
  }

  return <PublicParticipantsView tournamentId={tournament.id} />;
}
