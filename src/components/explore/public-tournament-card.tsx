import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, MapPin } from "lucide-react";

interface PublicTournamentCardProps {
  tournament: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    startDate: Date;
    endDate: Date;
    _count: {
      rounds: number;
      teams: number;
      locations: number;
    };
  };
}

function getTournamentDisplayStatus(tournament: PublicTournamentCardProps["tournament"]) {
  if (tournament.status === "COMPLETED") return { label: "Completed", variant: "secondary" as const };
  const now = new Date();
  const start = new Date(tournament.startDate);
  const end = new Date(tournament.endDate);
  if (start > now) return { label: "Upcoming", variant: "outline" as const };
  if (end >= now) return { label: "Live", variant: "destructive" as const };
  return { label: "Completed", variant: "secondary" as const };
}

export function PublicTournamentCard({ tournament }: PublicTournamentCardProps) {
  const start = new Date(tournament.startDate);
  const end = new Date(tournament.endDate);
  const displayStatus = getTournamentDisplayStatus(tournament);

  return (
    <Link href={`/tournaments/${tournament.slug}`} className="block">
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-lg">{tournament.name}</CardTitle>
          <Badge variant={displayStatus.variant}>{displayStatus.label}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {tournament.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {tournament.description}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {start.toLocaleDateString()} - {end.toLocaleDateString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {tournament._count.teams} teams
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {tournament._count.locations} courts
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
