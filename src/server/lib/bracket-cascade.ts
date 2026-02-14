/**
 * Pure bracket cascade analysis for score editing.
 * No DB calls -- operates on in-memory game arrays.
 */

export interface CascadeGameInput {
  id: string;
  team1Id: string | null;
  team2Id: string | null;
  status: string;
  scoreTeam1: number | null;
  scoreTeam2: number | null;
  feederGame1Id: string | null;
  feederGame2Id: string | null;
}

export interface CascadeAnalysis {
  winnerChanged: boolean;
  downstreamGames: string[];
  scoredDownstreamGames: string[];
  affectedGameIds: string[];
}

export interface GameClearAction {
  gameId: string;
  clearTeam1: boolean;
  clearTeam2: boolean;
  clearScores: boolean;
}

/**
 * Analyze what would happen if a game's winner changes.
 * BFS from the edited game following feeder relations forward.
 */
export function analyzeCascade(
  editedGameId: string,
  oldWinnerId: string | null,
  newWinnerId: string | null,
  allGames: CascadeGameInput[]
): CascadeAnalysis {
  // If winner didn't change, no cascade needed
  if (oldWinnerId === newWinnerId) {
    return {
      winnerChanged: false,
      downstreamGames: [],
      scoredDownstreamGames: [],
      affectedGameIds: [],
    };
  }

  // Build forward adjacency: gameId -> games that reference it as a feeder
  const fedBy = new Map<string, CascadeGameInput[]>();
  for (const g of allGames) {
    if (g.feederGame1Id) {
      if (!fedBy.has(g.feederGame1Id)) fedBy.set(g.feederGame1Id, []);
      fedBy.get(g.feederGame1Id)!.push(g);
    }
    if (g.feederGame2Id) {
      if (!fedBy.has(g.feederGame2Id)) fedBy.set(g.feederGame2Id, []);
      fedBy.get(g.feederGame2Id)!.push(g);
    }
  }

  // BFS from edited game
  const downstream: string[] = [];
  const scored: string[] = [];
  const visited = new Set<string>();
  const queue = [editedGameId];
  visited.add(editedGameId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = fedBy.get(current) ?? [];

    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      downstream.push(child.id);

      if (child.status === "COMPLETED" || child.status === "FORFEIT") {
        scored.push(child.id);
      }

      queue.push(child.id);
    }
  }

  return {
    winnerChanged: true,
    downstreamGames: downstream,
    scoredDownstreamGames: scored,
    affectedGameIds: [editedGameId, ...downstream],
  };
}

/**
 * Determine which team slots and scores to clear for each downstream game.
 * For each downstream game, figure out if the cascade chain reaches it
 * through feederGame1Id (clear team1) or feederGame2Id (clear team2).
 */
export function getGamesToClear(
  editedGameId: string,
  allGames: CascadeGameInput[]
): GameClearAction[] {
  // Build forward adjacency
  const fedBy = new Map<string, CascadeGameInput[]>();
  const gameMap = new Map(allGames.map((g) => [g.id, g]));

  for (const g of allGames) {
    if (g.feederGame1Id) {
      if (!fedBy.has(g.feederGame1Id)) fedBy.set(g.feederGame1Id, []);
      fedBy.get(g.feederGame1Id)!.push(g);
    }
    if (g.feederGame2Id) {
      if (!fedBy.has(g.feederGame2Id)) fedBy.set(g.feederGame2Id, []);
      fedBy.get(g.feederGame2Id)!.push(g);
    }
  }

  // BFS and track which team slot to clear
  const actions: GameClearAction[] = [];
  const visited = new Set<string>();
  const queue = [editedGameId];
  visited.add(editedGameId);
  // Track all games in the cascade chain for feeder checking
  const inCascade = new Set<string>([editedGameId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = fedBy.get(current) ?? [];

    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      inCascade.add(child.id);

      // Determine which slot(s) to clear based on which feeder is in the cascade
      const clearTeam1 = child.feederGame1Id !== null && inCascade.has(child.feederGame1Id);
      const clearTeam2 = child.feederGame2Id !== null && inCascade.has(child.feederGame2Id);
      const hasScores =
        child.status === "COMPLETED" || child.status === "FORFEIT";

      actions.push({
        gameId: child.id,
        clearTeam1,
        clearTeam2,
        clearScores: hasScores,
      });

      queue.push(child.id);
    }
  }

  return actions;
}
