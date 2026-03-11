import { Badge } from "@/components/ui/badge";

interface TournamentHeaderProps {
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  status: "PENDING" | "UNDERWAY" | "COMPLETE";
}

const STATUS_DISPLAY = {
  PENDING: { label: "Upcoming", variant: "outline" as const },
  UNDERWAY: { label: "Live", variant: "default" as const },
  COMPLETE: { label: "Completed", variant: "secondary" as const },
};

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

  const { label, variant } = STATUS_DISPLAY[status];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{name}</h1>
        <Badge variant={variant}>{label}</Badge>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Badminton</span>
        <span>{dateRange}</span>
      </div>
    </div>
  );
}
