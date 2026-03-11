import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { redirect } from "next/navigation";
import { SettingsTabContent } from "@/components/tournaments/settings-tab-content";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, caller] = await Promise.all([auth(), createServerCaller()]);
  const tournament = await caller.tournaments.getBySlug({ slug });

  if (!session?.user?.id || session.user.id !== tournament.ownerId) {
    redirect(`/tournaments/${slug}/bracket`);
  }

  return <SettingsTabContent tournamentId={tournament.id} />;
}
