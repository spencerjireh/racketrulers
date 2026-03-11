/**
 * Pure bracket generation functions shared between server and client.
 * No DB or server-only dependencies -- safe to import in "use client" components.
 */

export interface MatchSeed {
  participant1Id: string | null;
  participant2Id: string | null;
  roundPosition: number;
  feederGame1Id?: string;
  feederGame2Id?: string;
  /** Positional index into the returned array -- the game whose winner feeds into team1 */
  feederIndex1?: number;
  /** Positional index into the returned array -- the game whose winner feeds into team2 */
  feederIndex2?: number;
  /** Which bracket round this game belongs to (0-based) */
  bracketRound?: number;
  bracketType?: "winners" | "losers" | "grand_finals";
}

/**
 * Single Elimination bracket generation.
 * Standard seeding: 1 vs N, 2 vs N-1, etc.
 * Creates placeholder games for subsequent rounds with feeder links.
 */
export function generateSingleElimGames(
  teamIds: string[],
  consolation: boolean = false
): MatchSeed[] {
  if (teamIds.length < 2) return [];

  const n = teamIds.length;
  const bracketSize = nextPowerOf2(n);
  const totalRounds = Math.log2(bracketSize);

  // Create seeded matchups for first round
  const firstRoundMatchups = createSeededMatchups(bracketSize);
  const games: MatchSeed[] = [];
  let position = 1;

  // Track games per round for feeder linking
  const roundGames: Map<number, { position: number; index: number }[]> = new Map();

  // First round
  const firstRound: { position: number; index: number }[] = [];
  for (let i = 0; i < firstRoundMatchups.length; i++) {
    const [seed1, seed2] = firstRoundMatchups[i];
    const t1 = seed1 <= n ? teamIds[seed1 - 1] : null;
    const t2 = seed2 <= n ? teamIds[seed2 - 1] : null;

    firstRound.push({ position, index: games.length });
    games.push({
      participant1Id: t1,
      participant2Id: t2,
      roundPosition: position++,
      bracketRound: 0,
    });
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
      const auto1 = feeder1Game.participant1Id === null
        ? feeder1Game.participant2Id
        : feeder1Game.participant2Id === null
          ? feeder1Game.participant1Id
          : null;
      const auto2 = feeder2Game.participant1Id === null
        ? feeder2Game.participant2Id
        : feeder2Game.participant2Id === null
          ? feeder2Game.participant1Id
          : null;

      games.push({
        participant1Id: auto1,
        participant2Id: auto2,
        roundPosition: position++,
        feederIndex1: feeder1.index,
        feederIndex2: feeder2.index,
        bracketRound: round,
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
          participant1Id: null,
          participant2Id: null,
          roundPosition: position++,
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
): MatchSeed[] {
  if (teamIds.length < 2) return [];

  const n = teamIds.length;
  const bracketSize = nextPowerOf2(n);
  const wbRounds = Math.log2(bracketSize);

  const games: MatchSeed[] = [];
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
      participant1Id: t1,
      participant2Id: t2,
      roundPosition: position++,
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
      const auto1 = g1.participant1Id === null ? g1.participant2Id : g1.participant2Id === null ? g1.participant1Id : null;
      const auto2 = g2.participant1Id === null ? g2.participant2Id : g2.participant2Id === null ? g2.participant1Id : null;
      indices.push(games.length);
      games.push({
        participant1Id: auto1,
        participant2Id: auto2,
        roundPosition: position++,
        bracketType: "winners",
      });
    }
    wbRoundGames.set(round, indices);
  }

  // --- Losers Bracket ---
  const lbRoundGames: Map<number, number[]> = new Map();

  // LB Round 1: losers from WB Round 1 (half the games)
  const wbR1 = wbRoundGames.get(0)!;
  const lbR1Indices: number[] = [];
  for (let i = 0; i < wbR1.length; i += 2) {
    lbR1Indices.push(games.length);
    games.push({
      participant1Id: null,
      participant2Id: null,
      roundPosition: position++,
      bracketType: "losers",
    });
  }
  lbRoundGames.set(0, lbR1Indices);

  // LB subsequent rounds
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
        participant1Id: null,
        participant2Id: null,
        roundPosition: position++,
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
          participant1Id: null,
          participant2Id: null,
          roundPosition: position++,
          bracketType: "losers",
        });
      }
      lbRoundGames.set(lbRound, elimIndices);
      lbRound++;
    }
  }

  // --- Grand Finals ---
  games.push({
    participant1Id: null,
    participant2Id: null,
    roundPosition: position++,
    bracketType: "grand_finals",
  });

  // Optional reset match
  if (resetMatch) {
    games.push({
      participant1Id: null,
      participant2Id: null,
      roundPosition: position++,
      bracketType: "grand_finals",
    });
  }

  return games;
}

export function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function createSeededMatchups(bracketSize: number): [number, number][] {
  if (bracketSize === 2) return [[1, 2]];

  const order = buildBracketOrder(bracketSize);

  const matchups: [number, number][] = [];
  for (let i = 0; i < order.length; i += 2) {
    matchups.push([order[i], order[i + 1]]);
  }
  return matchups;
}

export function buildBracketOrder(bracketSize: number): number[] {
  let seeds = [1, 2];

  while (seeds.length < bracketSize) {
    const nextSize = seeds.length * 2;
    const nextSeeds: number[] = [];
    for (const seed of seeds) {
      nextSeeds.push(seed);
      nextSeeds.push(nextSize + 1 - seed);
    }
    seeds = nextSeeds;
  }

  return seeds;
}
