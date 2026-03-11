import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { getTournamentBySlug } from "@/lib/tournament-loader";
import { TournamentHeader } from "@/components/public/tournament-header";
import { TournamentNav } from "@/components/public/tournament-nav";
import { TournamentAdminBar } from "@/components/public/tournament-admin-bar";
import { RealtimeWrapper } from "@/components/public/realtime-wrapper";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const tournament = await getTournamentBySlug(slug);
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

  let tournament;
  try {
    tournament = await getTournamentBySlug(slug);
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const session = await auth();

  const isOwner = session?.user?.id === tournament.ownerId;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <TournamentHeader
          name={tournament.name}
          startDate={tournament.startDate}
          endDate={tournament.endDate}
          status={tournament.status}
        />
        {isOwner && (
          <TournamentAdminBar
            status={tournament.status}
            participantCount={tournament.participants.length}
            slug={slug}
            tournamentId={tournament.id}
          />
        )}
        <TournamentNav slug={slug} isOwner={isOwner} />
        <RealtimeWrapper tournamentId={tournament.id} />
        {children}
      </div>
    </div>
  );
}
