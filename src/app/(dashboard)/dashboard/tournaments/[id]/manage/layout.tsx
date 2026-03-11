import { redirect } from "next/navigation";
import { createServerCaller } from "@/lib/trpc/server";

export default async function ManageTournamentLayout({
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let slug: string;
  try {
    const caller = await createServerCaller();
    const tournament = await caller.tournaments.getById({ id });
    slug = tournament.slug;
  } catch {
    redirect("/dashboard/tournaments");
  }
  redirect(`/tournaments/${slug}`);
}
