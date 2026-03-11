import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { PublicScheduleView } from "@/components/public/schedule-view";
import { PublicBracketClient } from "./bracket-client";
import { BracketPreview } from "@/components/tournaments/bracket-preview";
import { type ScoringConfig } from "@/server/lib/scoring-validation";

export default async function PublicBracketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, caller] = await Promise.all([auth(), createServerCaller()]);
  const tournament = await caller.tournaments.getBySlug({ slug });

  const isOwner = session?.user?.id === tournament.ownerId;
  const isBracketFormat =
    tournament.format === "SINGLE_ELIM" || tournament.format === "DOUBLE_ELIM";

  if (isBracketFormat) {
    if (tournament.status === "PENDING") {
      if (isOwner) {
        return (
          <BracketPreview
            tournamentId={tournament.id}
            format={tournament.format as "SINGLE_ELIM" | "DOUBLE_ELIM"}
            thirdPlaceMatch={tournament.thirdPlaceMatch}
            grandFinalsModifier={tournament.grandFinalsModifier}
          />
        );
      }

      return (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          The bracket will be available once the tournament starts.
        </div>
      );
    }

    return (
      <PublicBracketClient
        tournamentId={tournament.id}
        interactive={isOwner}
        scoringConfig={tournament.scoringConfig ? (tournament.scoringConfig as unknown as ScoringConfig) : undefined}
      />
    );
  }

  return <PublicScheduleView tournamentId={tournament.id} />;
}
