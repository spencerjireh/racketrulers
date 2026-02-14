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

  const rounds = (tournament.rounds ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    pools: r.pools.map((p) => ({ id: p.id, name: p.name })),
  }));

  return <PublicStandingsView rounds={rounds} />;
}
