import { redirect } from "next/navigation";

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/tournaments/${slug}/bracket`);
}
