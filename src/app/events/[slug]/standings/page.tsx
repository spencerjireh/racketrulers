import { createServerCaller } from "@/lib/trpc/server";
import { PublicStandingsView } from "@/components/public/standings-view";

export default async function PublicStandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const caller = await createServerCaller();
  const event = await caller.events.getBySlug({ slug });

  const categories = (event.categories ?? []).map((cat) => ({
    id: cat.id,
    name: cat.name,
    rounds: cat.rounds.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      pools: r.pools.map((p) => ({ id: p.id, name: p.name })),
    })),
  }));

  return <PublicStandingsView eventId={event.id} categories={categories} />;
}
