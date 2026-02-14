import { describe, it, expect } from "vitest";
import {
  analyzeCascade,
  getGamesToClear,
  type CascadeGameInput,
} from "@/server/lib/bracket-cascade";

function makeGame(
  id: string,
  overrides: Partial<CascadeGameInput> = {}
): CascadeGameInput {
  return {
    id,
    team1Id: null,
    team2Id: null,
    status: "SCHEDULED",
    scoreTeam1: null,
    scoreTeam2: null,
    feederGame1Id: null,
    feederGame2Id: null,
    ...overrides,
  };
}

describe("analyzeCascade", () => {
  it("returns no cascade when winner unchanged", () => {
    const games = [
      makeGame("g1", { team1Id: "t1", team2Id: "t2", status: "COMPLETED" }),
      makeGame("g2", { feederGame1Id: "g1" }),
    ];

    const result = analyzeCascade("g1", "t1", "t1", games);

    expect(result.winnerChanged).toBe(false);
    expect(result.downstreamGames).toHaveLength(0);
    expect(result.scoredDownstreamGames).toHaveLength(0);
  });

  it("detects single downstream game needing clearing", () => {
    const games = [
      makeGame("sf1", { team1Id: "t1", team2Id: "t2", status: "COMPLETED" }),
      makeGame("sf2", { team1Id: "t3", team2Id: "t4", status: "COMPLETED" }),
      makeGame("final", {
        team1Id: "t1",
        team2Id: "t3",
        status: "SCHEDULED",
        feederGame1Id: "sf1",
        feederGame2Id: "sf2",
      }),
    ];

    const result = analyzeCascade("sf1", "t1", "t2", games);

    expect(result.winnerChanged).toBe(true);
    expect(result.downstreamGames).toEqual(["final"]);
    expect(result.scoredDownstreamGames).toHaveLength(0);
  });

  it("detects multi-level cascade (3 levels deep)", () => {
    // QF -> SF -> Final
    const games = [
      makeGame("qf1", { team1Id: "t1", team2Id: "t2", status: "COMPLETED" }),
      makeGame("qf2", { team1Id: "t3", team2Id: "t4", status: "COMPLETED" }),
      makeGame("sf1", {
        team1Id: "t1",
        team2Id: "t3",
        status: "COMPLETED",
        feederGame1Id: "qf1",
        feederGame2Id: "qf2",
      }),
      makeGame("qf3", { team1Id: "t5", team2Id: "t6", status: "COMPLETED" }),
      makeGame("sf2", {
        team1Id: "t5",
        team2Id: null,
        status: "SCHEDULED",
        feederGame1Id: "qf3",
      }),
      makeGame("final", {
        team1Id: "t1",
        team2Id: null,
        status: "SCHEDULED",
        feederGame1Id: "sf1",
        feederGame2Id: "sf2",
      }),
    ];

    const result = analyzeCascade("qf1", "t1", "t2", games);

    expect(result.winnerChanged).toBe(true);
    expect(result.downstreamGames).toContain("sf1");
    expect(result.downstreamGames).toContain("final");
    expect(result.downstreamGames).toHaveLength(2);
    expect(result.scoredDownstreamGames).toEqual(["sf1"]);
  });

  it("no cascade for round-robin games (no feeders)", () => {
    const games = [
      makeGame("rr1", { team1Id: "t1", team2Id: "t2", status: "COMPLETED" }),
      makeGame("rr2", { team1Id: "t1", team2Id: "t3", status: "COMPLETED" }),
      makeGame("rr3", { team1Id: "t2", team2Id: "t3", status: "COMPLETED" }),
    ];

    const result = analyzeCascade("rr1", "t1", "t2", games);

    expect(result.winnerChanged).toBe(true);
    expect(result.downstreamGames).toHaveLength(0);
    expect(result.scoredDownstreamGames).toHaveLength(0);
  });
});

describe("getGamesToClear", () => {
  it("returns empty for game with no downstream", () => {
    const games = [
      makeGame("g1", { team1Id: "t1", team2Id: "t2", status: "COMPLETED" }),
    ];

    const result = getGamesToClear("g1", games);
    expect(result).toHaveLength(0);
  });

  it("clears correct team slot based on feeder position", () => {
    const games = [
      makeGame("sf1", { team1Id: "t1", team2Id: "t2", status: "COMPLETED" }),
      makeGame("sf2", { team1Id: "t3", team2Id: "t4", status: "COMPLETED" }),
      makeGame("final", {
        team1Id: "t1",
        team2Id: "t3",
        status: "SCHEDULED",
        feederGame1Id: "sf1",
        feederGame2Id: "sf2",
      }),
    ];

    // Editing sf1 -> should clear team1 slot in final
    const result = getGamesToClear("sf1", games);

    expect(result).toHaveLength(1);
    expect(result[0].gameId).toBe("final");
    expect(result[0].clearTeam1).toBe(true);
    expect(result[0].clearTeam2).toBe(false);
    expect(result[0].clearScores).toBe(false);
  });

  it("marks scored downstream games for score clearing", () => {
    const games = [
      makeGame("sf1", { team1Id: "t1", team2Id: "t2", status: "COMPLETED" }),
      makeGame("sf2", { team1Id: "t3", team2Id: "t4", status: "COMPLETED" }),
      makeGame("final", {
        team1Id: "t1",
        team2Id: "t3",
        status: "COMPLETED",
        scoreTeam1: 2,
        scoreTeam2: 1,
        feederGame1Id: "sf1",
        feederGame2Id: "sf2",
      }),
    ];

    const result = getGamesToClear("sf1", games);

    expect(result).toHaveLength(1);
    expect(result[0].clearScores).toBe(true);
  });

  it("cascades through multiple levels", () => {
    const games = [
      makeGame("qf1", { team1Id: "t1", team2Id: "t2", status: "COMPLETED" }),
      makeGame("qf2", { team1Id: "t3", team2Id: "t4", status: "COMPLETED" }),
      makeGame("sf1", {
        team1Id: "t1",
        team2Id: "t3",
        status: "COMPLETED",
        scoreTeam1: 2,
        scoreTeam2: 0,
        feederGame1Id: "qf1",
        feederGame2Id: "qf2",
      }),
      makeGame("final", {
        team1Id: "t1",
        team2Id: null,
        status: "SCHEDULED",
        feederGame1Id: "sf1",
      }),
    ];

    const result = getGamesToClear("qf1", games);

    expect(result).toHaveLength(2);

    const sfAction = result.find((a) => a.gameId === "sf1")!;
    expect(sfAction.clearTeam1).toBe(true);
    expect(sfAction.clearTeam2).toBe(false);
    expect(sfAction.clearScores).toBe(true);

    const finalAction = result.find((a) => a.gameId === "final")!;
    expect(finalAction.clearTeam1).toBe(true);
    expect(finalAction.clearScores).toBe(false);
  });
});
