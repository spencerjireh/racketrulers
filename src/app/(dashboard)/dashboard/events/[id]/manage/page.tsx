import { redirect } from "next/navigation";

export default async function ManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/events/${id}/manage/settings`);
}
