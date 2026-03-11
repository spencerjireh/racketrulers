"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MatchCard, type MatchCardGame } from "./match-card";
import { SeedList } from "./seed-list";
import {
  generateSingleElimGames,
  generateDoubleElimGames,
  type MatchSeed,
} from "@/lib/game-generation";
import {
  computeBracketLayout,
  getBracketRoundLabel,
  CARD_WIDTH,
  CARD_HEIGHT,
  COL_GAP,
  ROW_GAP,
} from "@/lib/bracket-layout";
import { Info } from "lucide-react";

interface BracketPreviewProps {
  tournamentId: string;
  format: "SINGLE_ELIM" | "DOUBLE_ELIM";
  thirdPlaceMatch?: boolean;
  grandFinalsModifier?: string | null;
}

export function BracketPreview({
  tournamentId,
  format,
  thirdPlaceMatch = false,
  grandFinalsModifier,
}: BracketPreviewProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: participants, isLoading } = useQuery(
    trpc.participants.list.queryOptions({ tournamentId })
  );

  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const reorderMutation = useMutation(
    trpc.participants.reorderSeeds.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.participants.list.queryFilter({ tournamentId })
        );
      },
    })
  );

  // Debounce reorder persistence
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleReorder = useCallback(
    (participantIds: string[]) => {
      setLocalOrder(participantIds);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        reorderMutation.mutate({ tournamentId, participantIds });
      }, 500);
    },
    [tournamentId, reorderMutation]
  );

  // Determine ordered participants
  const orderedParticipants = useMemo(() => {
    if (!participants) return [];
    if (!localOrder) return [...participants].sort((a, b) => a.seed - b.seed);
    const map = new Map(participants.map((p) => [p.id, p]));
    return localOrder
      .map((id) => map.get(id))
      .filter((p): p is NonNullable<typeof p> => p != null);
  }, [participants, localOrder]);

  // Generate preview bracket
  const previewData = useMemo(() => {
    if (orderedParticipants.length < 2) return null;

    const ids = orderedParticipants.map((p) => p.id);
    let games: MatchSeed[];

    if (format === "SINGLE_ELIM") {
      games = generateSingleElimGames(ids, thirdPlaceMatch);
    } else {
      const resetMatch = grandFinalsModifier !== "GRAND_FINALS_SINGLE_MATCH";
      games = generateDoubleElimGames(ids, resetMatch);
    }

    // Assign synthetic IDs and group by bracketRound
    const participantMap = new Map(orderedParticipants.map((p) => [p.id, p]));
    const roundsMap = new Map<number, { id: string; game: MatchSeed }[]>();
    let maxRound = 0;

    games.forEach((game, index) => {
      const syntheticId = `preview-${index}`;
      const round = game.bracketRound ?? 0;
      maxRound = Math.max(maxRound, round);
      if (!roundsMap.has(round)) roundsMap.set(round, []);
      roundsMap.get(round)!.push({ id: syntheticId, game });
    });

    const totalRounds = maxRound + 1;

    // Build rounds for layout computation
    const rounds = Array.from({ length: totalRounds }, (_, i) => ({
      index: i,
      label: getBracketRoundLabel(i, totalRounds),
      games: (roundsMap.get(i) ?? []).map(({ id, game }, gi) => ({
        id,
        feederMatch1Id:
          game.feederIndex1 != null ? `preview-${game.feederIndex1}` : null,
        feederMatch2Id:
          game.feederIndex2 != null ? `preview-${game.feederIndex2}` : null,
      })),
    }));

    const layout = computeBracketLayout(rounds);

    // Build game data for match cards
    const gameMap = new Map<string, MatchCardGame>();
    games.forEach((game, index) => {
      const syntheticId = `preview-${index}`;
      const p1 = game.participant1Id
        ? participantMap.get(game.participant1Id)
        : null;
      const p2 = game.participant2Id
        ? participantMap.get(game.participant2Id)
        : null;

      gameMap.set(syntheticId, {
        id: syntheticId,
        status: "PENDING",
        participant1: p1 ? { id: p1.id, name: p1.name, seed: p1.seed } : null,
        participant2: p2 ? { id: p2.id, name: p2.name, seed: p2.seed } : null,
        scoreParticipant1: null,
        scoreParticipant2: null,
        setScores: null,
        location: null,
        scheduledAt: null,
        matchType: "SINGLES",
      });
    });

    return { rounds, layout, gameMap };
  }, [orderedParticipants, format, thirdPlaceMatch, grandFinalsModifier]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading preview...
      </div>
    );
  }

  if (!participants || participants.length < 2) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Add at least 2 participants to preview the bracket.
      </div>
    );
  }

  if (!previewData) return null;

  const { rounds, layout, gameMap } = previewData;
  const slotHeight = CARD_HEIGHT + ROW_GAP;
  const colWidth = CARD_WIDTH + COL_GAP;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Preview banner */}
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            This bracket is a preview. Drag seeds on the left to adjust
            placement. The bracket will be finalized when the tournament starts.
          </span>
        </div>

        {/* Split layout: seed list + bracket */}
        <div className="flex gap-6">
          {/* Seed list sidebar */}
          <div className="w-56 shrink-0">
            <SeedList
              participants={orderedParticipants.map((p) => ({
                id: p.id,
                name: p.name,
                seed: p.seed,
              }))}
              onReorder={handleReorder}
            />
          </div>

          {/* Bracket visualization */}
          <div className="flex-1 overflow-x-auto pb-4">
            <div
              style={{
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
                {layout.connectors.map((c, i) => (
                  <path
                    key={i}
                    d={`M ${c.x1} ${c.y1} H ${c.midX} V ${c.y2} H ${c.x2}`}
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                  />
                ))}
              </svg>

              {/* Match cards (non-interactive preview) */}
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
                    <MatchCard game={game} interactive={false} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
