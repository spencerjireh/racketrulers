import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Globe, CalendarDays } from "lucide-react";

interface PublicCoachCardProps {
  coach: {
    id: string;
    displayName: string;
    slug: string;
    sessionDurationMinutes: number;
    timezone: string;
    _count: {
      availability: number;
    };
  };
}

export function PublicCoachCard({ coach }: PublicCoachCardProps) {
  return (
    <Link href={`/book/${coach.slug}`} className="block">
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader>
          <CardTitle className="text-lg">{coach.displayName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {coach.sessionDurationMinutes} min sessions
            </span>
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" />
              {coach.timezone}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {coach._count.availability} availability slots
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
