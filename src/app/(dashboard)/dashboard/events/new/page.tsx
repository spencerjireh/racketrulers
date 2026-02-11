import { CreateEventForm } from "@/components/events/create-event-form";

export default function NewEventPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Event</h1>
        <p className="text-muted-foreground">
          Set up a new tournament or competition
        </p>
      </div>
      <CreateEventForm />
    </div>
  );
}
