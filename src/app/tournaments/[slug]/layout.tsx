import type { Metadata } from "next";
import { createServerCaller } from "@/lib/trpc/server";
import { TournamentHeader } from "@/components/public/tournament-header";
import { TournamentNav } from "@/components/public/tournament-nav";
import { RealtimeWrapper } from "@/components/public/realtime-wrapper";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const caller = await createServerCaller();
  try {
    const tournament = await caller.tournaments.getBySlug({ slug });
    return { title: tournament.name };
  } catch {
    return { title: "Tournament" };
  }
}

export default async function PublicTournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const caller = await createServerCaller();
  const tournament = await caller.tournaments.getBySlug({ slug });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <TournamentHeader
          name={tournament.name}
          startDate={tournament.startDate}
          endDate={tournament.endDate}
          status={tournament.status}
        />
        <TournamentNav slug={slug} />
        <RealtimeWrapper tournamentId={tournament.id} />
        {children}
      </div>
    </div>
  );
}
