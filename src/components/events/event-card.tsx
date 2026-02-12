import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EventCardProps {
  event: {
    id: string;
    name: string;
    status: "PUBLISHED" | "COMPLETED";
    startDate: Date;
    endDate: Date;
    _count: {
      categories: number;
      teams: number;
      locations: number;
    };
  };
}

export function EventCard({ event }: EventCardProps) {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg">{event.name}</CardTitle>
          <p className="text-sm text-muted-foreground">Badminton Tournament</p>
        </div>
        <Badge variant={event.status === "PUBLISHED" ? "default" : "secondary"}>
          {event.status === "PUBLISHED" ? "Active" : "Completed"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {start.toLocaleDateString()} - {end.toLocaleDateString()}
            </p>
            <p>
              {event._count.teams} teams / {event._count.locations} courts
            </p>
          </div>
          <Button asChild size="sm">
            <Link href={`/dashboard/events/${event.id}/manage`}>Manage</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
