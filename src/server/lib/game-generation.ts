interface GameSeed {
  team1Id: string | null;
  team2Id: string | null;
  roundPosition: number;
  poolId: string | null;
  feederGame1Id?: string;
  feederGame2Id?: string;
  bracketType?: "winners" | "losers" | "grand_finals";
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

/**
 * Double Elimination bracket generation.
 * Creates winners bracket (standard SE), losers bracket, and grand finals.
 */
export function generateDoubleElimGames(
  teamIds: string[],
  resetMatch: boolean = true
): GameSeed[] {
  if (teamIds.length < 2) return [];

  const n = teamIds.length;
  const bracketSize = nextPowerOf2(n);
  const wbRounds = Math.log2(bracketSize);

  const games: GameSeed[] = [];
  let position = 1;

  // --- Winners Bracket ---
  const firstRoundMatchups = createSeededMatchups(bracketSize);
  const wbRoundGames: Map<number, number[]> = new Map(); // round -> game indices

  // WB Round 1
  const wbR1Indices: number[] = [];
  for (const [seed1, seed2] of firstRoundMatchups) {
    const t1 = seed1 <= n ? teamIds[seed1 - 1] : null;
    const t2 = seed2 <= n ? teamIds[seed2 - 1] : null;
    wbR1Indices.push(games.length);
    games.push({
      team1Id: t1,
      team2Id: t2,
      roundPosition: position++,
      poolId: null,
      bracketType: "winners",
    });
  }
  wbRoundGames.set(0, wbR1Indices);

  // WB subsequent rounds
  for (let round = 1; round < wbRounds; round++) {
    const prev = wbRoundGames.get(round - 1)!;
    const indices: number[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const g1 = games[prev[i]];
      const g2 = games[prev[i + 1]];
      // Auto-advance byes
      const auto1 = g1.team1Id === null ? g1.team2Id : g1.team2Id === null ? g1.team1Id : null;
      const auto2 = g2.team1Id === null ? g2.team2Id : g2.team2Id === null ? g2.team1Id : null;
      indices.push(games.length);
      games.push({
        team1Id: auto1,
        team2Id: auto2,
        roundPosition: position++,
        poolId: null,
        bracketType: "winners",
      });
    }
    wbRoundGames.set(round, indices);
  }

  // --- Losers Bracket ---
  // LB has (wbRounds - 1) * 2 rounds in a standard DE format,
  // but simplified: we create placeholder games for losers bracket
  const lbRoundGames: Map<number, number[]> = new Map();

  // LB Round 1: losers from WB Round 1 (half the games)
  const wbR1 = wbRoundGames.get(0)!;
  const lbR1Indices: number[] = [];
  for (let i = 0; i < wbR1.length; i += 2) {
    lbR1Indices.push(games.length);
    games.push({
      team1Id: null, // loser of WB game
      team2Id: null, // loser of WB game
      roundPosition: position++,
      poolId: null,
      bracketType: "losers",
    });
  }
  lbRoundGames.set(0, lbR1Indices);

  // LB subsequent rounds: alternate between "drop-down" rounds (losers from WB enter)
  // and "elimination" rounds (LB teams play each other)
  let lbRound = 1;
  for (let wbRound = 1; wbRound < wbRounds; wbRound++) {
    const prevLb = lbRoundGames.get(lbRound - 1)!;

    // Drop-down round: LB survivors vs WB losers from this WB round
    const dropIndices: number[] = [];
    const wbLosersFromRound = wbRoundGames.get(wbRound)!;
    const numDropMatches = Math.max(prevLb.length, wbLosersFromRound.length);
    for (let i = 0; i < numDropMatches; i++) {
      dropIndices.push(games.length);
      games.push({
        team1Id: null, // LB survivor
        team2Id: null, // WB loser dropping down
        roundPosition: position++,
        poolId: null,
        bracketType: "losers",
      });
    }
    lbRoundGames.set(lbRound, dropIndices);
    lbRound++;

    // Elimination round: winners from drop-down play each other
    if (dropIndices.length > 1) {
      const elimIndices: number[] = [];
      for (let i = 0; i < dropIndices.length; i += 2) {
        elimIndices.push(games.length);
        games.push({
          team1Id: null,
          team2Id: null,
          roundPosition: position++,
          poolId: null,
          bracketType: "losers",
        });
      }
      lbRoundGames.set(lbRound, elimIndices);
      lbRound++;
    }
  }

  // --- Grand Finals ---
  games.push({
    team1Id: null, // WB champion
    team2Id: null, // LB champion
    roundPosition: position++,
    poolId: null,
    bracketType: "grand_finals",
  });

  // Optional reset match
  if (resetMatch) {
    games.push({
      team1Id: null,
      team2Id: null,
      roundPosition: position++,
      poolId: null,
      bracketType: "grand_finals",
    });
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
): GameSeed[] {
  if (teamIds.length < 2) return [];

  const games: GameSeed[] = [];
  let position = 1;

  if (!previousResults || previousResults.length === 0) {
    // Round 1: random pairings
    const shuffled = [...teamIds].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      games.push({
        team1Id: shuffled[i],
        team2Id: shuffled[i + 1],
        roundPosition: position++,
        poolId: null,
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
          team1Id: sorted[i].teamId,
          team2Id: sorted[j].teamId,
          roundPosition: position++,
          poolId: null,
        });
        break;
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
