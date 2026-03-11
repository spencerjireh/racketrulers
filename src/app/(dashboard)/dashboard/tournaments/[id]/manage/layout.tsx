import { redirect } from "next/navigation";
import { createServerCaller } from "@/lib/trpc/server";

export default async function ManageTournamentLayout({
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caller = await createServerCaller();

  let tournament;
  try {
    tournament = await caller.tournaments.getById({ id });
  } catch {
    redirect("/dashboard/tournaments");
  }

  redirect(`/tournaments/${tournament.slug}`);
}
