"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { type ScoringConfig, type SetScore, DEFAULT_SCORING_CONFIG } from "@/server/lib/scoring-validation";
import { useScoreEntry } from "@/hooks/use-score-entry";

interface BracketViewProps {
  tournamentId: string;
  interactive?: boolean;
  scoringConfig?: ScoringConfig;
}

const ZOOM_LEVELS = [0.5, 0.75, 1.0];

export function BracketView({
  tournamentId,
  interactive = false,
  scoringConfig,
}: BracketViewProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const config = scoringConfig ?? DEFAULT_SCORING_CONFIG;

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  const queryOptions = interactive
    ? trpc.matches.getBracketData.queryOptions({ tournamentId })
    : trpc.matches.getBracketDataPublic.queryOptions({ tournamentId });

  const { data, isLoading } = useQuery(queryOptions);
  const rounds = data?.rounds;

  const layout = useMemo(() => {
    if (!rounds) return null;
    return computeBracketLayout(
      rounds.map((r) => ({
        index: r.index,
        games: r.games.map((g) => ({
          id: g.id,
          feederMatch1Id: g.feederMatch1Id,
          feederMatch2Id: g.feederMatch2Id,
        })),
      }))
    );
  }, [rounds]);

  // Build a match lookup for positioning and dialog population
  const gameMap = useMemo(() => {
    if (!rounds) return new Map<string, MatchCardGame>();
    const map = new Map<string, MatchCardGame>();
    for (const round of rounds) {
      for (const g of round.games) {
        map.set(g.id, {
          id: g.id,
          status: g.status,
          participant1: g.participant1 ? { ...g.participant1, seed: 0 } : null,
          participant2: g.participant2 ? { ...g.participant2, seed: 0 } : null,
          scoreParticipant1: g.scoreParticipant1,
          scoreParticipant2: g.scoreParticipant2,
          setScores: g.setScores as SetScore[] | null,
          location: g.location,
          scheduledAt: g.scheduledAt,
          matchType: g.matchType,
        });
      }
    }
    return map;
  }, [rounds]);

  const invalidateBracket = () => {
    queryClient.invalidateQueries(
      interactive
        ? trpc.matches.getBracketData.queryFilter({ tournamentId })
        : trpc.matches.getBracketDataPublic.queryFilter({ tournamentId })
    );
    queryClient.invalidateQueries(
      trpc.matches.listByTournament.queryFilter({ tournamentId })
    );
    queryClient.invalidateQueries(
      trpc.matches.getStandings.queryFilter({ tournamentId })
    );
  };

  const {
    scoringGameId,
    setScoringGameId,
    cascadeInfo,
    setCascadeInfo,
    submitScore,
    submitForfeit,
    confirmCascade,
    isPending,
  } = useScoreEntry(tournamentId, invalidateBracket);

  // Derive the selected game from the hook's scoringGameId — this automatically
  // closes the dialog when the hook sets scoringGameId to null on mutation success.
  const scoringGame = scoringGameId ? (gameMap.get(scoringGameId) ?? null) : null;

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
        No bracket data. Start the tournament to generate matches.
      </div>
    );
  }

  const slotHeight = CARD_HEIGHT + ROW_GAP;
  const colWidth = CARD_WIDTH + COL_GAP;

  return (
    <TooltipProvider>
      <div ref={containerRef} className={cn("relative", isFullscreen && "bg-background p-4 overflow-auto")}>
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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
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
                  sourceGame?.status === "COMPLETE" ||
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
                    onScore={interactive ? (g) => setScoringGameId(g.id) : undefined}
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
              open={!!scoringGameId}
              onOpenChange={(open) => {
                if (!open) setScoringGameId(null);
              }}
              onSubmit={(data) => {
                if (scoringGameId) {
                  submitScore(scoringGameId, data.setScores);
                }
              }}
              onForfeit={(winnerId) => {
                if (scoringGameId) {
                  submitForfeit(scoringGameId, winnerId);
                }
              }}
              team1={scoringGame?.participant1 ?? null}
              team2={scoringGame?.participant2 ?? null}
              scoringConfig={config}
              currentSetScores={
                scoringGame?.setScores as SetScore[] | null | undefined
              }
              isPending={isPending}
            />

            <CascadeWarningDialog
              open={!!cascadeInfo}
              onOpenChange={(open) => {
                if (!open) setCascadeInfo(null);
              }}
              onConfirm={confirmCascade}
              downstreamCount={cascadeInfo?.downstreamCount ?? 0}
              scoredCount={cascadeInfo?.scoredCount ?? 0}
              isPending={isPending}
            />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
