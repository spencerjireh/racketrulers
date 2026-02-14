"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface SetScore {
  team1: number;
  team2: number;
}

interface TeamInfo {
  id: string;
  name: string;
  seed: number;
}

export interface MatchCardGame {
  id: string;
  status: string;
  team1: TeamInfo | null;
  team2: TeamInfo | null;
  scoreTeam1: number | null;
  scoreTeam2: number | null;
  setScores: SetScore[] | null;
  location: { id: string; name: string } | null;
  scheduledAt: Date | string | null;
  matchType: string;
}

interface MatchCardProps {
  game: MatchCardGame;
  interactive?: boolean;
  onScore?: (game: MatchCardGame) => void;
}

function isBye(game: MatchCardGame) {
  return (game.team1 === null) !== (game.team2 === null);
}

function getWinnerId(game: MatchCardGame): string | null {
  if (game.status !== "COMPLETED" && game.status !== "FORFEIT") return null;
  if (game.scoreTeam1 != null && game.scoreTeam2 != null) {
    if (game.scoreTeam1 > game.scoreTeam2) return game.team1?.id ?? null;
    if (game.scoreTeam2 > game.scoreTeam1) return game.team2?.id ?? null;
  }
  return null;
}

function TeamRow({
  team,
  score,
  isWinner,
  isLoser,
}: {
  team: TeamInfo | null;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
}) {
  if (!team) {
    return (
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
        <span className="italic">TBD</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-1.5",
        isWinner && "bg-primary/5 font-semibold",
        isLoser && "text-muted-foreground"
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[10px] text-muted-foreground tabular-nums w-4 text-right shrink-0">
          {team.seed || ""}
        </span>
        <span className="text-sm truncate">{team.name}</span>
      </div>
      {score != null && (
        <span className="text-sm font-mono tabular-nums ml-2 shrink-0">{score}</span>
      )}
    </div>
  );
}

export function MatchCard({ game, interactive, onScore }: MatchCardProps) {
  const bye = isBye(game);
  const winnerId = getWinnerId(game);

  const borderColor =
    game.status === "COMPLETED" || game.status === "FORFEIT"
      ? "border-l-primary"
      : game.status === "IN_PROGRESS"
        ? "border-l-amber-500"
        : "border-l-border";

  const tooltipContent = [
    game.location?.name,
    game.scheduledAt
      ? new Date(game.scheduledAt).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null,
    game.matchType === "DOUBLES" ? "Doubles" : null,
  ]
    .filter(Boolean)
    .join(" -- ");

  const card = (
    <div
      className={cn(
        "w-56 rounded-lg border border-l-[3px] bg-card shadow-sm overflow-hidden",
        borderColor,
        bye && "opacity-60",
        interactive &&
          "cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
      )}
      onClick={interactive && onScore ? () => onScore(game) : undefined}
    >
      <TeamRow
        team={game.team1}
        score={game.scoreTeam1}
        isWinner={winnerId === game.team1?.id}
        isLoser={winnerId != null && winnerId !== game.team1?.id}
      />
      <div className="border-t border-dashed mx-2" />
      <TeamRow
        team={game.team2}
        score={game.scoreTeam2}
        isWinner={winnerId === game.team2?.id}
        isLoser={winnerId != null && winnerId !== game.team2?.id}
      />
      {game.setScores && game.setScores.length > 0 && !bye && (
        <div className="border-t px-3 py-1 text-center">
          <span className="text-[10px] text-muted-foreground font-mono">
            {game.setScores.map((s, i) => (
              <span key={i}>
                {i > 0 && "  "}
                {s.team1}-{s.team2}
              </span>
            ))}
          </span>
        </div>
      )}
      {bye && (
        <div className="border-t px-3 py-0.5 text-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            bye
          </span>
        </div>
      )}
    </div>
  );

  if (!tooltipContent) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}
