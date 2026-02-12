export interface ScoringConfig {
  pointsPerSet: number;
  totalSets: number;
  deuceEnabled: boolean;
  maxPoints: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  pointsPerSet: 21,
  totalSets: 3,
  deuceEnabled: true,
  maxPoints: 30,
};

export interface SetScore {
  team1: number;
  team2: number;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  setsWon: { team1: number; team2: number };
}

export function validateSetScore(
  set: SetScore,
  config: ScoringConfig
): { valid: boolean; error?: string } {
  const { team1, team2 } = set;
  const { pointsPerSet, deuceEnabled, maxPoints } = config;

  if (!Number.isInteger(team1) || !Number.isInteger(team2) || team1 < 0 || team2 < 0) {
    return { valid: false, error: "Scores must be non-negative integers" };
  }

  const winner = Math.max(team1, team2);
  const loser = Math.min(team1, team2);

  if (winner < pointsPerSet) {
    return { valid: false, error: `Winning score must be at least ${pointsPerSet}` };
  }

  if (!deuceEnabled) {
    // No deuce: winner must have exactly pointsPerSet
    if (winner !== pointsPerSet) {
      return { valid: false, error: `Score must be exactly ${pointsPerSet} to win` };
    }
    return { valid: true };
  }

  // Deuce rules
  if (loser < pointsPerSet - 1) {
    // Not a deuce situation: winner must have exactly pointsPerSet
    if (winner !== pointsPerSet) {
      return { valid: false, error: `Score must be ${pointsPerSet} when not at deuce` };
    }
    return { valid: true };
  }

  // Deuce situation (loser >= pointsPerSet - 1)
  if (winner === maxPoints) {
    // At the cap, any score is valid as long as loser >= pointsPerSet - 1
    return { valid: true };
  }

  // Must win by 2
  if (winner - loser !== 2) {
    return {
      valid: false,
      error: `Must win by 2 points at deuce (or reach ${maxPoints})`,
    };
  }

  if (winner > maxPoints) {
    return { valid: false, error: `Score cannot exceed ${maxPoints}` };
  }

  return { valid: true };
}

export function validateMatchScores(
  setScores: SetScore[],
  config: ScoringConfig
): ValidationResult {
  const setsToWin = Math.ceil(config.totalSets / 2);

  if (setScores.length === 0) {
    return { valid: false, error: "At least one set is required", setsWon: { team1: 0, team2: 0 } };
  }

  if (setScores.length > config.totalSets) {
    return {
      valid: false,
      error: `Cannot have more than ${config.totalSets} sets`,
      setsWon: { team1: 0, team2: 0 },
    };
  }

  let team1Sets = 0;
  let team2Sets = 0;

  for (let i = 0; i < setScores.length; i++) {
    const setValidation = validateSetScore(setScores[i], config);
    if (!setValidation.valid) {
      return {
        valid: false,
        error: `Set ${i + 1}: ${setValidation.error}`,
        setsWon: { team1: team1Sets, team2: team2Sets },
      };
    }

    if (setScores[i].team1 > setScores[i].team2) {
      team1Sets++;
    } else {
      team2Sets++;
    }

    // Check if match was already decided before this set
    if (i < setScores.length - 1) {
      if (team1Sets === setsToWin || team2Sets === setsToWin) {
        return {
          valid: false,
          error: `Match was already decided after set ${i + 1}`,
          setsWon: { team1: team1Sets, team2: team2Sets },
        };
      }
    }
  }

  // Match must have a winner
  if (team1Sets !== setsToWin && team2Sets !== setsToWin) {
    return {
      valid: false,
      error: `Match is incomplete -- need ${setsToWin} sets to win`,
      setsWon: { team1: team1Sets, team2: team2Sets },
    };
  }

  return { valid: true, setsWon: { team1: team1Sets, team2: team2Sets } };
}
