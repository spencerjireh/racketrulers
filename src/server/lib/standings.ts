interface GameData {
  team1Id: string | null;
  team2Id: string | null;
  scoreTeam1: number | null;
  scoreTeam2: number | null;
  status: string;
}

interface PointsConfig {
  win: number;
  draw: number;
  loss: number;
}

interface TiebreakerConfig {
  order: string[];
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  rank: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  standingPoints: number;
  gamesPlayed: number;
}

export function calculateStandings(
  games: (GameData & { team1?: { id: string; name: string } | null; team2?: { id: string; name: string } | null })[],
  pointsConfig: PointsConfig = { win: 2, draw: 1, loss: 0 },
  tiebreakerConfig: TiebreakerConfig = {
    order: ["win_loss", "head_to_head", "point_differential", "points_scored"],
  }
): TeamStanding[] {
  const statsMap = new Map<
    string,
    {
      teamName: string;
      wins: number;
      draws: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
      gamesPlayed: number;
      headToHead: Map<string, { wins: number; losses: number; draws: number }>;
    }
  >();

  function ensureTeam(teamId: string, teamName: string) {
    if (!statsMap.has(teamId)) {
      statsMap.set(teamId, {
        teamName,
        wins: 0,
        draws: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        gamesPlayed: 0,
        headToHead: new Map(),
      });
    }
  }

  function ensureH2H(teamId: string, opponentId: string) {
    const stats = statsMap.get(teamId)!;
    if (!stats.headToHead.has(opponentId)) {
      stats.headToHead.set(opponentId, { wins: 0, losses: 0, draws: 0 });
    }
  }

  for (const game of games) {
    if (
      game.status !== "COMPLETED" &&
      game.status !== "FORFEIT"
    )
      continue;
    if (!game.team1Id || !game.team2Id) continue;
    if (game.scoreTeam1 === null || game.scoreTeam2 === null) continue;

    const t1Name = game.team1?.name ?? game.team1Id;
    const t2Name = game.team2?.name ?? game.team2Id;

    ensureTeam(game.team1Id, t1Name);
    ensureTeam(game.team2Id, t2Name);
    ensureH2H(game.team1Id, game.team2Id);
    ensureH2H(game.team2Id, game.team1Id);

    const s1 = statsMap.get(game.team1Id)!;
    const s2 = statsMap.get(game.team2Id)!;

    s1.pointsFor += game.scoreTeam1;
    s1.pointsAgainst += game.scoreTeam2;
    s1.gamesPlayed++;
    s2.pointsFor += game.scoreTeam2;
    s2.pointsAgainst += game.scoreTeam1;
    s2.gamesPlayed++;

    const h2h1 = s1.headToHead.get(game.team2Id)!;
    const h2h2 = s2.headToHead.get(game.team1Id)!;

    if (game.scoreTeam1 > game.scoreTeam2) {
      s1.wins++;
      s2.losses++;
      h2h1.wins++;
      h2h2.losses++;
    } else if (game.scoreTeam1 < game.scoreTeam2) {
      s2.wins++;
      s1.losses++;
      h2h2.wins++;
      h2h1.losses++;
    } else {
      s1.draws++;
      s2.draws++;
      h2h1.draws++;
      h2h2.draws++;
    }
  }

  const standings: TeamStanding[] = Array.from(statsMap.entries()).map(
    ([teamId, stats]) => ({
      teamId,
      teamName: stats.teamName,
      rank: 0,
      wins: stats.wins,
      draws: stats.draws,
      losses: stats.losses,
      pointsFor: stats.pointsFor,
      pointsAgainst: stats.pointsAgainst,
      pointDifferential: stats.pointsFor - stats.pointsAgainst,
      standingPoints:
        stats.wins * pointsConfig.win +
        stats.draws * pointsConfig.draw +
        stats.losses * pointsConfig.loss,
      gamesPlayed: stats.gamesPlayed,
    })
  );

  // Sort by tiebreaker rules
  standings.sort((a, b) => {
    for (const rule of tiebreakerConfig.order) {
      let diff = 0;
      switch (rule) {
        case "win_loss":
          diff = b.standingPoints - a.standingPoints;
          break;
        case "head_to_head": {
          const aStats = statsMap.get(a.teamId)!;
          const h2h = aStats.headToHead.get(b.teamId);
          if (h2h) {
            diff = h2h.wins - h2h.losses;
          }
          break;
        }
        case "point_differential":
          diff = b.pointDifferential - a.pointDifferential;
          break;
        case "points_scored":
          diff = b.pointsFor - a.pointsFor;
          break;
        case "points_allowed":
          diff = a.pointsAgainst - b.pointsAgainst;
          break;
      }
      if (diff !== 0) return diff;
    }
    return 0;
  });

  // Assign ranks
  standings.forEach((s, i) => {
    s.rank = i + 1;
  });

  return standings;
}
