import { redirect } from "next/navigation";

export default async function ManageTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/tournaments/${id}/manage/settings`);
}
