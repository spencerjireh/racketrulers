import { createServerCaller } from "@/lib/trpc/server";
import { EventHeader } from "@/components/public/event-header";
import { EventNav } from "@/components/public/event-nav";
import { RealtimeWrapper } from "@/components/public/realtime-wrapper";

export default async function PublicEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const caller = await createServerCaller();
  const event = await caller.events.getBySlug({ slug });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <EventHeader
          name={event.name}
          startDate={event.startDate}
          endDate={event.endDate}
          status={event.status}
        />
        <EventNav slug={slug} />
        <RealtimeWrapper eventId={event.id} />
        {children}
      </div>
    </div>
  );
}
