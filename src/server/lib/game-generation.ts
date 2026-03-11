import { fisherYatesShuffle } from "@/lib/utils";

// Re-export bracket generation from shared location (client-importable)
export {
  type MatchSeed,
  generateSingleElimGames,
  generateDoubleElimGames,
  nextPowerOf2,
  createSeededMatchups,
  buildBracketOrder,
} from "@/lib/game-generation";

// Import MatchSeed type for use in server-only functions below
import type { MatchSeed } from "@/lib/game-generation";

/**
 * Round Robin game generation using circle method.
 * For N teams, generates N*(N-1)/2 games.
 * Handles odd team count by adding a BYE placeholder (games with BYE are skipped).
 */
export function generateRoundRobinGames(
  teamIds: string[]
): MatchSeed[] {
  if (teamIds.length < 2) return [];

  const teams = [...teamIds];
  const hasBye = teams.length % 2 !== 0;
  if (hasBye) teams.push("BYE");

  const n = teams.length;
  const games: MatchSeed[] = [];
  let position = 1;

  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];

      if (home === "BYE" || away === "BYE") continue;

      games.push({
        participant1Id: home,
        participant2Id: away,
        roundPosition: position++,
      });
    }

    // Rotate: fix first element, rotate rest
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  return games;
}

/**
 * Swiss pairing generation (Monrad system).
 * Round 1: Random or seeded pairings.
 * Subsequent rounds: Pair teams with similar records, avoiding rematches.
 */
export function generateSwissPairings(
  teamIds: string[],
  previousResults?: { teamId: string; wins: number; losses: number }[]
): MatchSeed[] {
  if (teamIds.length < 2) return [];

  const games: MatchSeed[] = [];
  let position = 1;

  if (!previousResults || previousResults.length === 0) {
    // Round 1: random pairings
    const shuffled = fisherYatesShuffle([...teamIds]);
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      games.push({
        participant1Id: shuffled[i],
        participant2Id: shuffled[i + 1],
        roundPosition: position++,
      });
    }
    // If odd number, last team gets a bye (no game created)
  } else {
    // Sort by win count descending, then pair adjacent teams
    const sorted = [...previousResults].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    const paired = new Set<string>();

    for (let i = 0; i < sorted.length; i++) {
      if (paired.has(sorted[i].teamId)) continue;
      // Find the next unpaired team
      for (let j = i + 1; j < sorted.length; j++) {
        if (paired.has(sorted[j].teamId)) continue;
        paired.add(sorted[i].teamId);
        paired.add(sorted[j].teamId);
        games.push({
          participant1Id: sorted[i].teamId,
          participant2Id: sorted[j].teamId,
          roundPosition: position++,
        });
        break;
      }
    }
  }

  return games;
}
