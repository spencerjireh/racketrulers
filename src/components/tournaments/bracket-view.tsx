"use client";

import { useState, useMemo, useRef } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MatchCard, type MatchCardGame } from "./match-card";
import { ScoreEntryDialog } from "./score-entry-dialog";
import { CascadeWarningDialog } from "./cascade-warning-dialog";
import {
  computeBracketLayout,
  CARD_WIDTH,
  CARD_HEIGHT,
  COL_GAP,
  ROW_GAP,
} from "@/lib/bracket-layout";

interface ScoringConfig {
  pointsPerSet: number;
  totalSets: number;
  deuceEnabled: boolean;
  maxPoints: number;
}

interface SetScore {
  team1: number;
  team2: number;
}

interface BracketViewProps {
  tournamentId: string;
  roundId: string;
  interactive?: boolean;
  scoringConfig?: ScoringConfig;
}

const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  pointsPerSet: 21,
  totalSets: 3,
  deuceEnabled: true,
  maxPoints: 30,
};

const ZOOM_LEVELS = [0.5, 0.75, 1.0];

export function BracketView({
  tournamentId,
  roundId,
  interactive = false,
  scoringConfig,
}: BracketViewProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [zoom, setZoom] = useState(1.0);
  const [scoringGame, setScoringGame] = useState<MatchCardGame | null>(null);
  const [cascadeInfo, setCascadeInfo] = useState<{
    downstreamCount: number;
    scoredCount: number;
    gameId: string;
  } | null>(null);
  const lastSubmittedScores = useRef<{ team1: number; team2: number }[]>([]);
  const config = scoringConfig ?? DEFAULT_SCORING_CONFIG;

  const queryKey = interactive ? "getBracketData" : "getBracketDataPublic";
  const queryOptions = interactive
    ? trpc.games.getBracketData.queryOptions({ roundId, tournamentId })
    : trpc.games.getBracketDataPublic.queryOptions({ roundId, tournamentId });

  const { data, isLoading } = useQuery(queryOptions);
  const rounds = data?.rounds;

  const layout = useMemo(() => {
    if (!rounds) return null;
    return computeBracketLayout(
      rounds.map((r) => ({
        index: r.index,
        games: r.games.map((g) => ({
          id: g.id,
          feederGame1Id: g.feederGame1Id,
          feederGame2Id: g.feederGame2Id,
        })),
      }))
    );
  }, [rounds]);

  // Build a game lookup for positioning
  const gameMap = useMemo(() => {
    if (!rounds) return new Map<string, MatchCardGame>();
    const map = new Map<string, MatchCardGame>();
    for (const round of rounds) {
      for (const g of round.games) {
        map.set(g.id, g as unknown as MatchCardGame);
      }
    }
    return map;
  }, [rounds]);

  const invalidateBracket = () => {
    queryClient.invalidateQueries({ queryKey: [["games", queryKey]] });
    queryClient.invalidateQueries({
      queryKey: [["games", "listByRound"]],
    });
    queryClient.invalidateQueries({
      queryKey: [["games", "getStandings"]],
    });
  };

  const updateScore = useMutation(
    trpc.games.updateScore.mutationOptions({
      onSuccess: () => {
        invalidateBracket();
        setScoringGame(null);
        setCascadeInfo(null);
        toast.success("Score saved");
      },
      onError: (err) => {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.type === "CASCADE_REQUIRED" && scoringGame) {
            setCascadeInfo({
              downstreamCount: parsed.downstreamCount,
              scoredCount: parsed.scoredCount,
              gameId: scoringGame.id,
            });
            return;
          }
        } catch {
          // Not a cascade error
        }
        toast.error(err.message);
      },
    })
  );

  const updateStatus = useMutation(
    trpc.games.updateStatus.mutationOptions({
      onSuccess: () => {
        invalidateBracket();
        setScoringGame(null);
        toast.success("Status updated");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading bracket...
      </div>
    );
  }

  if (!rounds || rounds.length === 0 || !layout) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No bracket data. Generate games first.
      </div>
    );
  }

  const slotHeight = CARD_HEIGHT + ROW_GAP;
  const colWidth = CARD_WIDTH + COL_GAP;

  return (
    <TooltipProvider>
      <div className="relative">
        {/* Zoom controls */}
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1 bg-background/80 backdrop-blur rounded-lg border p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() =>
              setZoom((z) => {
                const idx = ZOOM_LEVELS.indexOf(z);
                return idx > 0 ? ZOOM_LEVELS[idx - 1] : z;
              })
            }
            disabled={zoom === ZOOM_LEVELS[0]}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-mono w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() =>
              setZoom((z) => {
                const idx = ZOOM_LEVELS.indexOf(z);
                return idx < ZOOM_LEVELS.length - 1
                  ? ZOOM_LEVELS[idx + 1]
                  : z;
              })
            }
            disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {zoom !== 1.0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(1.0)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Scrollable bracket container */}
        <div className="overflow-x-auto pt-10 pb-4">
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: layout.totalWidth,
              height: layout.totalHeight + 32,
              position: "relative",
            }}
          >
            {/* Round labels */}
            {rounds.map((round) => (
              <div
                key={round.index}
                className="absolute top-0 text-xs font-medium text-muted-foreground"
                style={{
                  left: round.index * colWidth,
                  width: CARD_WIDTH,
                  textAlign: "center",
                }}
              >
                {round.label}
              </div>
            ))}

            {/* SVG connector layer */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={layout.totalWidth}
              height={layout.totalHeight + 32}
              style={{ top: 24 }}
            >
              {layout.connectors.map((c, i) => {
                const sourceGame = gameMap.get(c.fromId);
                const isCompleted =
                  sourceGame?.status === "COMPLETED" ||
                  sourceGame?.status === "FORFEIT";

                return (
                  <path
                    key={i}
                    d={`M ${c.x1} ${c.y1} H ${c.midX} V ${c.y2} H ${c.x2}`}
                    fill="none"
                    stroke={
                      isCompleted
                        ? "var(--color-primary)"
                        : "var(--color-border)"
                    }
                    strokeWidth={isCompleted ? 2 : 1.5}
                    strokeOpacity={isCompleted ? 0.7 : 0.4}
                  />
                );
              })}
            </svg>

            {/* Match cards */}
            {layout.nodes.map((node) => {
              const game = gameMap.get(node.gameId);
              if (!game) return null;

              return (
                <div
                  key={node.gameId}
                  className="absolute"
                  style={{
                    left: node.col * colWidth,
                    top: 24 + node.row * slotHeight,
                  }}
                >
                  <MatchCard
                    game={game}
                    interactive={interactive}
                    onScore={interactive ? setScoringGame : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Score entry dialog (interactive mode only) */}
        {interactive && (
          <>
            <ScoreEntryDialog
              open={!!scoringGame}
              onOpenChange={(open) => {
                if (!open) setScoringGame(null);
              }}
              onSubmit={(data) => {
                if (scoringGame) {
                  lastSubmittedScores.current = data.setScores;
                  updateScore.mutate({
                    id: scoringGame.id,
                    tournamentId,
                    setScores: data.setScores,
                  });
                }
              }}
              onForfeit={(winnerId) => {
                if (scoringGame) {
                  updateStatus.mutate({
                    id: scoringGame.id,
                    tournamentId,
                    status: "FORFEIT",
                    forfeitWinnerId: winnerId,
                  });
                }
              }}
              onCancel={() => {
                if (scoringGame) {
                  updateStatus.mutate({
                    id: scoringGame.id,
                    tournamentId,
                    status: "CANCELLED",
                  });
                }
              }}
              team1={scoringGame?.team1 ?? null}
              team2={scoringGame?.team2 ?? null}
              scoringConfig={config}
              currentSetScores={
                scoringGame?.setScores as SetScore[] | null | undefined
              }
              isPending={updateScore.isPending || updateStatus.isPending}
            />

            <CascadeWarningDialog
              open={!!cascadeInfo}
              onOpenChange={(open) => {
                if (!open) setCascadeInfo(null);
              }}
              onConfirm={() => {
                if (cascadeInfo) {
                  updateScore.mutate({
                    id: cascadeInfo.gameId,
                    tournamentId,
                    setScores: lastSubmittedScores.current,
                    confirmCascade: true,
                  });
                }
              }}
              downstreamCount={cascadeInfo?.downstreamCount ?? 0}
              scoredCount={cascadeInfo?.scoredCount ?? 0}
              isPending={updateScore.isPending}
            />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
