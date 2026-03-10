import { Badge } from "@/components/ui/badge";
import { GameStatusBadge } from "@/components/tournaments/game-status-badge";

interface SetScore {
  team1: number;
  team2: number;
}

interface GameCardProps {
  participant1Name: string;
  participant2Name: string;
  scoreParticipant1: number | null;
  scoreParticipant2: number | null;
  setScores?: SetScore[] | null;
  matchType?: string;
  status: string;
  scheduledAt: string | Date | null;
  locationName: string | null;
}

export function GameCard({
  participant1Name,
  participant2Name,
  scoreParticipant1,
  scoreParticipant2,
  setScores,
  matchType,
  status,
  scheduledAt,
  locationName,
}: GameCardProps) {
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {matchType && (
            <Badge variant="outline" className="text-xs">
              {matchType === "DOUBLES" ? "Doubles" : "Singles"}
            </Badge>
          )}
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
        <span className="font-medium text-sm truncate">{participant1Name}</span>
        <span className="font-mono text-lg font-bold px-2">
          {scoreParticipant1 !== null && scoreParticipant2 !== null
            ? `${scoreParticipant1} - ${scoreParticipant2}`
            : "vs"}
        </span>
        <span className="font-medium text-sm truncate text-right">
          {participant2Name}
        </span>
      </div>
      {setScores && setScores.length > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          {setScores.map((s, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {s.team1}-{s.team2}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
