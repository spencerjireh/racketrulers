import { redirect } from "next/navigation";
import { createServerCaller } from "@/lib/trpc/server";
import { Badge } from "@/components/ui/badge";
import { EventStepper } from "@/components/events/event-stepper";

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

  const statusLabel =
    event.status === "DRAFT"
      ? "Draft"
      : event.status === "PUBLISHED"
        ? "Active"
        : "Completed";

  const statusVariant =
    event.status === "DRAFT"
      ? "outline"
      : event.status === "PUBLISHED"
        ? "default"
        : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <Badge variant={statusVariant as "default" | "secondary" | "outline"}>
          {statusLabel}
        </Badge>
      </div>
      <EventStepper eventId={id} status={event.status} />
      {children}
    </div>
  );
}
