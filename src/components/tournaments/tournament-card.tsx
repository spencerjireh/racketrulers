import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface TournamentCardProps {
  tournament: {
    id: string;
    name: string;
    status: "PENDING" | "UNDERWAY" | "COMPLETE";
    startDate: Date;
    endDate: Date;
    _count: {
      matches: number;
      participants: number;
      locations: number;
    };
  };
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const start = new Date(tournament.startDate);
  const end = new Date(tournament.endDate);

  const statusLabel =
    tournament.status === "PENDING"
      ? "Setup"
      : tournament.status === "UNDERWAY"
        ? "Active"
        : "Completed";

  const statusVariant =
    tournament.status === "PENDING"
      ? "outline"
      : tournament.status === "UNDERWAY"
        ? "default"
        : "secondary";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg">{tournament.name}</CardTitle>
          <p className="text-sm text-muted-foreground">Badminton Tournament</p>
        </div>
        <Badge variant={statusVariant as "default" | "secondary" | "outline"}>
          {statusLabel}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {start.toLocaleDateString()} - {end.toLocaleDateString()}
            </p>
            <p>
              {tournament._count.participants} participants / {tournament._count.locations} courts
            </p>
          </div>
          <Button asChild size="sm">
            <Link href={`/dashboard/tournaments/${tournament.id}/manage`}>
              {tournament.status === "PENDING" ? "Setup" : "Manage"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
