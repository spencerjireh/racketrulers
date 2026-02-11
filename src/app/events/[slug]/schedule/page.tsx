import { createServerCaller } from "@/lib/trpc/server";
import { PublicScheduleView } from "@/components/public/schedule-view";

export default async function PublicSchedulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const caller = await createServerCaller();
  const event = await caller.events.getBySlug({ slug });

  return <PublicScheduleView eventId={event.id} />;
}
