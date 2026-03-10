/**
 * Pure bracket cascade analysis for score editing.
 * No DB calls -- operates on in-memory game arrays.
 */

export interface CascadeGameInput {
  id: string;
  participant1Id: string | null;
  participant2Id: string | null;
  status: string;
  scoreParticipant1: number | null;
  scoreParticipant2: number | null;
  feederMatch1Id: string | null;
  feederMatch2Id: string | null;
}

export interface CascadeAnalysis {
  winnerChanged: boolean;
  downstreamGames: string[];
  scoredDownstreamGames: string[];
  affectedGameIds: string[];
}

export interface GameClearAction {
  matchId: string;
  clearTeam1: boolean;
  clearTeam2: boolean;
  clearScores: boolean;
}

function buildFedByMap(games: CascadeGameInput[]): Map<string, CascadeGameInput[]> {
  const map = new Map<string, CascadeGameInput[]>();
  for (const g of games) {
    for (const feederId of [g.feederMatch1Id, g.feederMatch2Id]) {
      if (!feederId) continue;
      if (!map.has(feederId)) map.set(feederId, []);
      map.get(feederId)!.push(g);
    }
  }
  return map;
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
  const fedBy = buildFedByMap(allGames);

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

      if (child.status === "COMPLETE" || child.status === "FORFEIT") {
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
 * through feederMatch1Id (clear team1) or feederMatch2Id (clear team2).
 */
export function getGamesToClear(
  editedGameId: string,
  allGames: CascadeGameInput[]
): GameClearAction[] {
  // Build forward adjacency
  const fedBy = buildFedByMap(allGames);

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
      const clearTeam1 = child.feederMatch1Id !== null && inCascade.has(child.feederMatch1Id);
      const clearTeam2 = child.feederMatch2Id !== null && inCascade.has(child.feederMatch2Id);
      const hasScores =
        child.status === "COMPLETE" || child.status === "FORFEIT";

      actions.push({
        matchId: child.id,
        clearTeam1,
        clearTeam2,
        clearScores: hasScores,
      });

      queue.push(child.id);
    }
  }

  return actions;
}
