import { Badge } from "@/components/ui/badge";

interface TournamentHeaderProps {
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  status: string;
}

export function TournamentHeader({
  name,
  startDate,
  endDate,
  status,
}: TournamentHeaderProps) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dateRange = start.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " - " + end.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{name}</h1>
        {(() => {
          const now = new Date();
          const displayStatus = status === "COMPLETED"
            ? { label: "Completed", variant: "secondary" as const }
            : start > now
              ? { label: "Upcoming", variant: "outline" as const }
              : end >= now
                ? { label: "Live", variant: "default" as const }
                : { label: "Completed", variant: "secondary" as const };
          return <Badge variant={displayStatus.variant}>{displayStatus.label}</Badge>;
        })()}
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Badminton</span>
        <span>{dateRange}</span>
      </div>
    </div>
  );
}
