interface GameData {
  participant1Id: string | null;
  participant2Id: string | null;
  scoreParticipant1: number | null;
  scoreParticipant2: number | null;
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

export interface ParticipantStanding {
  participantId: string;
  participantName: string;
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
  games: (GameData & { participant1?: { id: string; name: string } | null; participant2?: { id: string; name: string } | null })[],
  pointsConfig: PointsConfig = { win: 2, draw: 1, loss: 0 },
  tiebreakerConfig: TiebreakerConfig = {
    order: ["win_loss", "head_to_head", "point_differential", "points_scored"],
  }
): ParticipantStanding[] {
  const statsMap = new Map<
    string,
    {
      participantName: string;
      wins: number;
      draws: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
      gamesPlayed: number;
      headToHead: Map<string, { wins: number; losses: number; draws: number }>;
    }
  >();

  function ensureParticipant(participantId: string, participantName: string) {
    if (!statsMap.has(participantId)) {
      statsMap.set(participantId, {
        participantName,
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

  function ensureH2H(participantId: string, opponentId: string) {
    const stats = statsMap.get(participantId)!;
    if (!stats.headToHead.has(opponentId)) {
      stats.headToHead.set(opponentId, { wins: 0, losses: 0, draws: 0 });
    }
  }

  for (const game of games) {
    if (
      game.status !== "COMPLETE" &&
      game.status !== "FORFEIT"
    )
      continue;
    if (!game.participant1Id || !game.participant2Id) continue;
    if (game.scoreParticipant1 === null || game.scoreParticipant2 === null) continue;

    const p1Name = game.participant1?.name ?? game.participant1Id;
    const p2Name = game.participant2?.name ?? game.participant2Id;

    ensureParticipant(game.participant1Id, p1Name);
    ensureParticipant(game.participant2Id, p2Name);
    ensureH2H(game.participant1Id, game.participant2Id);
    ensureH2H(game.participant2Id, game.participant1Id);

    const s1 = statsMap.get(game.participant1Id)!;
    const s2 = statsMap.get(game.participant2Id)!;

    s1.pointsFor += game.scoreParticipant1;
    s1.pointsAgainst += game.scoreParticipant2;
    s1.gamesPlayed++;
    s2.pointsFor += game.scoreParticipant2;
    s2.pointsAgainst += game.scoreParticipant1;
    s2.gamesPlayed++;

    const h2h1 = s1.headToHead.get(game.participant2Id)!;
    const h2h2 = s2.headToHead.get(game.participant1Id)!;

    if (game.scoreParticipant1 > game.scoreParticipant2) {
      s1.wins++;
      s2.losses++;
      h2h1.wins++;
      h2h2.losses++;
    } else if (game.scoreParticipant1 < game.scoreParticipant2) {
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

  const standings: ParticipantStanding[] = Array.from(statsMap.entries()).map(
    ([participantId, stats]) => ({
      participantId,
      participantName: stats.participantName,
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
          const aStats = statsMap.get(a.participantId)!;
          const h2h = aStats.headToHead.get(b.participantId);
          if (h2h) {
            diff = h2h.losses - h2h.wins;
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
