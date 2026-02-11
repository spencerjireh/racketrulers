import { redirect } from "next/navigation";
import { createServerCaller } from "@/lib/trpc/server";
import { Badge } from "@/components/ui/badge";
import { ManageNav } from "@/components/events/manage-nav";

export default async function ManageEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caller = await createServerCaller();

  let event;
  try {
    event = await caller.events.getById({ id });
  } catch {
    redirect("/dashboard/events");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <Badge variant={event.status === "PUBLISHED" ? "default" : "secondary"}>
          {event.status === "PUBLISHED" ? "Active" : "Completed"}
        </Badge>
      </div>
      <ManageNav eventId={id} />
      {children}
    </div>
  );
}
