import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";

export default function EventsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Events</h1>
          <p className="text-muted-foreground">
            Create and manage your tournaments
          </p>
        </div>
        <Button>Create Event</Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Trophy className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No events yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first tournament to get started
          </p>
          <Button className="mt-4">Create Event</Button>
        </CardContent>
      </Card>
    </div>
  );
}
