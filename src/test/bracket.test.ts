import { describe, it, expect } from "vitest";
import { generateSingleElimGames } from "@/server/lib/game-generation";
import { computeBracketLayout } from "@/lib/bracket-layout";

describe("generateSingleElimGames", () => {
  it("generates correct feeder indices for 4 teams", () => {
    const teams = ["a", "b", "c", "d"];
    const games = generateSingleElimGames(teams);

    // 4 teams = 2 first-round games + 1 final = 3 games
    expect(games).toHaveLength(3);

    // First-round games have no feeder indices
    expect(games[0].feederIndex1).toBeUndefined();
    expect(games[0].feederIndex2).toBeUndefined();
    expect(games[0].bracketRound).toBe(0);

    expect(games[1].feederIndex1).toBeUndefined();
    expect(games[1].feederIndex2).toBeUndefined();
    expect(games[1].bracketRound).toBe(0);

    // Final references both first-round games
    expect(games[2].feederIndex1).toBe(0);
    expect(games[2].feederIndex2).toBe(1);
    expect(games[2].bracketRound).toBe(1);
  });

  it("generates correct feeder indices for 8 teams", () => {
    const teams = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
    const games = generateSingleElimGames(teams);

    // 8 teams = 4 + 2 + 1 = 7 games
    expect(games).toHaveLength(7);

    // All first-round games (indices 0-3) have bracketRound 0
    for (let i = 0; i < 4; i++) {
      expect(games[i].bracketRound).toBe(0);
      expect(games[i].feederIndex1).toBeUndefined();
      expect(games[i].feederIndex2).toBeUndefined();
    }

    // Semifinals (indices 4-5) have bracketRound 1
    expect(games[4].bracketRound).toBe(1);
    expect(games[4].feederIndex1).toBe(0);
    expect(games[4].feederIndex2).toBe(1);

    expect(games[5].bracketRound).toBe(1);
    expect(games[5].feederIndex1).toBe(2);
    expect(games[5].feederIndex2).toBe(3);

    // Final (index 6) has bracketRound 2
    expect(games[6].bracketRound).toBe(2);
    expect(games[6].feederIndex1).toBe(4);
    expect(games[6].feederIndex2).toBe(5);
  });

  it("generates correct structure for 16 teams", () => {
    const teams = Array.from({ length: 16 }, (_, i) => `team${i + 1}`);
    const games = generateSingleElimGames(teams);

    // 16 teams = 8 + 4 + 2 + 1 = 15 games
    expect(games).toHaveLength(15);

    // Round 0: indices 0-7
    for (let i = 0; i < 8; i++) {
      expect(games[i].bracketRound).toBe(0);
    }
    // Round 1 (QF): indices 8-11
    for (let i = 8; i < 12; i++) {
      expect(games[i].bracketRound).toBe(1);
    }
    // Round 2 (SF): indices 12-13
    for (let i = 12; i < 14; i++) {
      expect(games[i].bracketRound).toBe(2);
    }
    // Round 3 (Final): index 14
    expect(games[14].bracketRound).toBe(3);
  });

  it("handles non-power-of-2 teams (5 teams) with byes", () => {
    const teams = ["a", "b", "c", "d", "e"];
    const games = generateSingleElimGames(teams);

    // 5 teams -> bracket size 8 = 4 + 2 + 1 = 7 games
    expect(games).toHaveLength(7);

    // Some first-round games should have one null team (bye)
    const byeGames = games.filter(
      (g) =>
        g.bracketRound === 0 &&
        ((g.team1Id === null) !== (g.team2Id === null))
    );
    expect(byeGames.length).toBe(3); // 8 - 5 = 3 byes

    // Second-round games with bye feeders should have auto-advanced teams
    const r1Games = games.filter((g) => g.bracketRound === 1);
    for (const g of r1Games) {
      // At least one team should be auto-advanced from a bye
      expect(g.feederIndex1).toBeDefined();
      expect(g.feederIndex2).toBeDefined();
    }
  });

  it("handles 2 teams (minimum)", () => {
    const games = generateSingleElimGames(["a", "b"]);
    expect(games).toHaveLength(1);
    expect(games[0].team1Id).toBe("a");
    expect(games[0].team2Id).toBe("b");
    expect(games[0].bracketRound).toBe(0);
  });

  it("handles 3 teams with a bye", () => {
    const games = generateSingleElimGames(["a", "b", "c"]);
    // 3 teams -> bracket size 4 = 2 + 1 = 3 games
    expect(games).toHaveLength(3);

    const byeGames = games.filter(
      (g) => g.bracketRound === 0 && (g.team1Id === null || g.team2Id === null)
    );
    expect(byeGames.length).toBe(1);
  });
});

describe("computeBracketLayout", () => {
  it("returns empty layout for no rounds", () => {
    const layout = computeBracketLayout([]);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.connectors).toHaveLength(0);
    expect(layout.totalCols).toBe(0);
  });

  it("lays out a 4-team bracket correctly", () => {
    const rounds = [
      {
        index: 0,
        games: [
          { id: "g1", feederGame1Id: null, feederGame2Id: null },
          { id: "g2", feederGame1Id: null, feederGame2Id: null },
        ],
      },
      {
        index: 1,
        games: [
          { id: "g3", feederGame1Id: "g1", feederGame2Id: "g2" },
        ],
      },
    ];

    const layout = computeBracketLayout(rounds);

    expect(layout.nodes).toHaveLength(3);
    expect(layout.totalCols).toBe(2);

    // First-round games at rows 0 and 1
    const g1 = layout.nodes.find((n) => n.gameId === "g1")!;
    const g2 = layout.nodes.find((n) => n.gameId === "g2")!;
    expect(g1.col).toBe(0);
    expect(g1.row).toBe(0);
    expect(g2.col).toBe(0);
    expect(g2.row).toBe(1);

    // Final centered between them
    const g3 = layout.nodes.find((n) => n.gameId === "g3")!;
    expect(g3.col).toBe(1);
    expect(g3.row).toBe(0.5);

    // Should have 2 connectors (g1->g3, g2->g3)
    expect(layout.connectors).toHaveLength(2);
  });

  it("lays out an 8-team bracket correctly", () => {
    const rounds = [
      {
        index: 0,
        games: [
          { id: "g1", feederGame1Id: null, feederGame2Id: null },
          { id: "g2", feederGame1Id: null, feederGame2Id: null },
          { id: "g3", feederGame1Id: null, feederGame2Id: null },
          { id: "g4", feederGame1Id: null, feederGame2Id: null },
        ],
      },
      {
        index: 1,
        games: [
          { id: "sf1", feederGame1Id: "g1", feederGame2Id: "g2" },
          { id: "sf2", feederGame1Id: "g3", feederGame2Id: "g4" },
        ],
      },
      {
        index: 2,
        games: [
          { id: "final", feederGame1Id: "sf1", feederGame2Id: "sf2" },
        ],
      },
    ];

    const layout = computeBracketLayout(rounds);

    expect(layout.nodes).toHaveLength(7);
    expect(layout.totalCols).toBe(3);

    // Final should be centered between semifinals
    const sf1 = layout.nodes.find((n) => n.gameId === "sf1")!;
    const sf2 = layout.nodes.find((n) => n.gameId === "sf2")!;
    const final = layout.nodes.find((n) => n.gameId === "final")!;
    expect(final.row).toBe((sf1.row + sf2.row) / 2);

    // Should have 6 connectors (4 from QF->SF + 2 from SF->F)
    expect(layout.connectors).toHaveLength(6);
  });

  it("lays out a 16-team bracket with correct column count", () => {
    // Build 16-team bracket structure
    const r0 = Array.from({ length: 8 }, (_, i) => ({
      id: `r0_${i}`,
      feederGame1Id: null,
      feederGame2Id: null,
    }));
    const r1 = Array.from({ length: 4 }, (_, i) => ({
      id: `r1_${i}`,
      feederGame1Id: r0[i * 2].id,
      feederGame2Id: r0[i * 2 + 1].id,
    }));
    const r2 = Array.from({ length: 2 }, (_, i) => ({
      id: `r2_${i}`,
      feederGame1Id: r1[i * 2].id,
      feederGame2Id: r1[i * 2 + 1].id,
    }));
    const r3 = [
      { id: "final", feederGame1Id: r2[0].id, feederGame2Id: r2[1].id },
    ];

    const rounds = [
      { index: 0, games: r0 },
      { index: 1, games: r1 },
      { index: 2, games: r2 },
      { index: 3, games: r3 },
    ];

    const layout = computeBracketLayout(rounds);

    expect(layout.nodes).toHaveLength(15);
    expect(layout.totalCols).toBe(4);

    // 14 connectors: 8->4 + 4->2 + 2->1 = 8+4+2
    expect(layout.connectors).toHaveLength(14);
  });
});
