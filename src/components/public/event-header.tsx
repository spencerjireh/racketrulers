import { Badge } from "@/components/ui/badge";

interface EventHeaderProps {
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  status: string;
}

export function EventHeader({
  name,
  startDate,
  endDate,
  status,
}: EventHeaderProps) {
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
        <Badge variant={status === "COMPLETED" ? "secondary" : "default"}>
          {status === "COMPLETED" ? "Completed" : "Live"}
        </Badge>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Badminton</span>
        <span>{dateRange}</span>
      </div>
    </div>
  );
}
