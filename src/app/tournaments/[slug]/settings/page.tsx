import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournament-loader";
import { SettingsTabContent } from "@/components/tournaments/settings-tab-content";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, tournament] = await Promise.all([auth(), getTournamentBySlug(slug)]);

  if (!session?.user?.id || session.user.id !== tournament.ownerId) {
    redirect(`/tournaments/${slug}/bracket`);
  }

  return <SettingsTabContent tournamentId={tournament.id} />;
}
