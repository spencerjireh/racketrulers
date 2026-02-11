interface GameSeed {
  team1Id: string | null;
  team2Id: string | null;
  roundPosition: number;
  poolId: string | null;
  feederGame1Id?: string;
  feederGame2Id?: string;
}

/**
 * Round Robin game generation using circle method.
 * For N teams, generates N*(N-1)/2 games.
 * Handles odd team count by adding a BYE placeholder (games with BYE are skipped).
 */
export function generateRoundRobinGames(
  poolId: string,
  teamIds: string[]
): GameSeed[] {
  if (teamIds.length < 2) return [];

  const teams = [...teamIds];
  const hasBye = teams.length % 2 !== 0;
  if (hasBye) teams.push("BYE");

  const n = teams.length;
  const games: GameSeed[] = [];
  let position = 1;

  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];

      if (home === "BYE" || away === "BYE") continue;

      games.push({
        team1Id: home,
        team2Id: away,
        roundPosition: position++,
        poolId,
      });
    }

    // Rotate: fix first element, rotate rest
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  return games;
}

/**
 * Single Elimination bracket generation.
 * Standard seeding: 1 vs N, 2 vs N-1, etc.
 * Creates placeholder games for subsequent rounds with feeder links.
 */
export function generateSingleElimGames(
  teamIds: string[],
  consolation: boolean = false
): GameSeed[] {
  if (teamIds.length < 2) return [];

  const n = teamIds.length;
  const bracketSize = nextPowerOf2(n);
  const numByes = bracketSize - n;
  const totalRounds = Math.log2(bracketSize);

  // Create seeded matchups for first round
  const firstRoundMatchups = createSeededMatchups(bracketSize);
  const games: GameSeed[] = [];
  let position = 1;

  // Track games per round for feeder linking
  const roundGames: Map<number, { position: number; index: number }[]> = new Map();

  // First round
  const firstRound: { position: number; index: number }[] = [];
  for (let i = 0; i < firstRoundMatchups.length; i++) {
    const [seed1, seed2] = firstRoundMatchups[i];
    const t1 = seed1 <= n ? teamIds[seed1 - 1] : null;
    const t2 = seed2 <= n ? teamIds[seed2 - 1] : null;

    // If one team is a bye, skip this game (winner advances automatically)
    if (t1 === null || t2 === null) {
      // We still create the game entry but it will be auto-resolved
      firstRound.push({ position, index: games.length });
      games.push({
        team1Id: t1,
        team2Id: t2,
        roundPosition: position++,
        poolId: null,
      });
    } else {
      firstRound.push({ position: position, index: games.length });
      games.push({
        team1Id: t1,
        team2Id: t2,
        roundPosition: position++,
        poolId: null,
      });
    }
  }
  roundGames.set(0, firstRound);

  // Subsequent rounds
  for (let round = 1; round < totalRounds; round++) {
    const prevRound = roundGames.get(round - 1)!;
    const thisRound: { position: number; index: number }[] = [];

    for (let i = 0; i < prevRound.length; i += 2) {
      const feeder1 = prevRound[i];
      const feeder2 = prevRound[i + 1];

      thisRound.push({ position, index: games.length });

      // Check if either feeder is a bye game (auto-advance the non-null team)
      const feeder1Game = games[feeder1.index];
      const feeder2Game = games[feeder2.index];
      const auto1 = feeder1Game.team1Id === null
        ? feeder1Game.team2Id
        : feeder1Game.team2Id === null
          ? feeder1Game.team1Id
          : null;
      const auto2 = feeder2Game.team1Id === null
        ? feeder2Game.team2Id
        : feeder2Game.team2Id === null
          ? feeder2Game.team1Id
          : null;

      games.push({
        team1Id: auto1,
        team2Id: auto2,
        roundPosition: position++,
        poolId: null,
      });
    }
    roundGames.set(round, thisRound);
  }

  // Consolation (3rd place) match
  if (consolation && totalRounds >= 2) {
    const semis = roundGames.get(totalRounds - 1);
    if (semis && semis.length === 1) {
      // Semi-finals are in the second-to-last round
      const semiRound = roundGames.get(totalRounds - 2);
      if (semiRound && semiRound.length === 2) {
        games.push({
          team1Id: null,
          team2Id: null,
          roundPosition: position++,
          poolId: null,
        });
      }
    }
  }

  return games;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Creates standard seeded matchups for a bracket.
 * 1 vs N, 2 vs N-1, etc. with proper bracket placement.
 */
function createSeededMatchups(bracketSize: number): [number, number][] {
  if (bracketSize === 2) return [[1, 2]];

  const matchups: [number, number][] = [];
  const half = bracketSize / 2;

  for (let i = 0; i < half; i++) {
    matchups.push([i + 1, bracketSize - i]);
  }

  // Reorder for proper bracket structure
  return reorderForBracket(matchups);
}

function reorderForBracket(matchups: [number, number][]): [number, number][] {
  if (matchups.length <= 1) return matchups;

  const result: [number, number][] = [];
  const n = matchups.length;

  for (let i = 0; i < n; i += 2) {
    result.push(matchups[i]);
  }
  for (let i = 1; i < n; i += 2) {
    result.push(matchups[i]);
  }

  return result;
}
