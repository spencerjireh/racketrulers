import { GameStatusBadge } from "@/components/events/game-status-badge";

interface GameCardProps {
  team1Name: string;
  team2Name: string;
  scoreTeam1: number | null;
  scoreTeam2: number | null;
  status: string;
  scheduledAt: string | Date | null;
  locationName: string | null;
  poolName: string | null;
}

export function GameCard({
  team1Name,
  team2Name,
  scoreTeam1,
  scoreTeam2,
  status,
  scheduledAt,
  locationName,
  poolName,
}: GameCardProps) {
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {poolName && <span>{poolName}</span>}
          {scheduledAt && (
            <span>
              {new Date(scheduledAt).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {locationName && <span>{locationName}</span>}
        </div>
        <GameStatusBadge status={status} />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="font-medium text-sm truncate">{team1Name}</span>
        <span className="font-mono text-lg font-bold px-2">
          {scoreTeam1 !== null && scoreTeam2 !== null
            ? `${scoreTeam1} - ${scoreTeam2}`
            : "vs"}
        </span>
        <span className="font-medium text-sm truncate text-right">
          {team2Name}
        </span>
      </div>
    </div>
  );
}
