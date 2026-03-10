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
    participant1Id: null,
    participant2Id: null,
    status: "PENDING",
    scoreParticipant1: null,
    scoreParticipant2: null,
    feederMatch1Id: null,
    feederMatch2Id: null,
    ...overrides,
  };
}

describe("analyzeCascade", () => {
  it("returns no cascade when winner unchanged", () => {
    const games = [
      makeGame("g1", { participant1Id: "t1", participant2Id: "t2", status: "COMPLETE" }),
      makeGame("g2", { feederMatch1Id: "g1" }),
    ];

    const result = analyzeCascade("g1", "t1", "t1", games);

    expect(result.winnerChanged).toBe(false);
    expect(result.downstreamGames).toHaveLength(0);
    expect(result.scoredDownstreamGames).toHaveLength(0);
  });

  it("detects single downstream game needing clearing", () => {
    const games = [
      makeGame("sf1", { participant1Id: "t1", participant2Id: "t2", status: "COMPLETE" }),
      makeGame("sf2", { participant1Id: "t3", participant2Id: "t4", status: "COMPLETE" }),
      makeGame("final", {
        participant1Id: "t1",
        participant2Id: "t3",
        status: "PENDING",
        feederMatch1Id: "sf1",
        feederMatch2Id: "sf2",
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
      makeGame("qf1", { participant1Id: "t1", participant2Id: "t2", status: "COMPLETE" }),
      makeGame("qf2", { participant1Id: "t3", participant2Id: "t4", status: "COMPLETE" }),
      makeGame("sf1", {
        participant1Id: "t1",
        participant2Id: "t3",
        status: "COMPLETE",
        feederMatch1Id: "qf1",
        feederMatch2Id: "qf2",
      }),
      makeGame("qf3", { participant1Id: "t5", participant2Id: "t6", status: "COMPLETE" }),
      makeGame("sf2", {
        participant1Id: "t5",
        participant2Id: null,
        status: "PENDING",
        feederMatch1Id: "qf3",
      }),
      makeGame("final", {
        participant1Id: "t1",
        participant2Id: null,
        status: "PENDING",
        feederMatch1Id: "sf1",
        feederMatch2Id: "sf2",
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
      makeGame("rr1", { participant1Id: "t1", participant2Id: "t2", status: "COMPLETE" }),
      makeGame("rr2", { participant1Id: "t1", participant2Id: "t3", status: "COMPLETE" }),
      makeGame("rr3", { participant1Id: "t2", participant2Id: "t3", status: "COMPLETE" }),
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
      makeGame("g1", { participant1Id: "t1", participant2Id: "t2", status: "COMPLETE" }),
    ];

    const result = getGamesToClear("g1", games);
    expect(result).toHaveLength(0);
  });

  it("clears correct team slot based on feeder position", () => {
    const games = [
      makeGame("sf1", { participant1Id: "t1", participant2Id: "t2", status: "COMPLETE" }),
      makeGame("sf2", { participant1Id: "t3", participant2Id: "t4", status: "COMPLETE" }),
      makeGame("final", {
        participant1Id: "t1",
        participant2Id: "t3",
        status: "PENDING",
        feederMatch1Id: "sf1",
        feederMatch2Id: "sf2",
      }),
    ];

    // Editing sf1 -> should clear team1 slot in final
    const result = getGamesToClear("sf1", games);

    expect(result).toHaveLength(1);
    expect(result[0].matchId).toBe("final");
    expect(result[0].clearTeam1).toBe(true);
    expect(result[0].clearTeam2).toBe(false);
    expect(result[0].clearScores).toBe(false);
  });

  it("marks scored downstream games for score clearing", () => {
    const games = [
      makeGame("sf1", { participant1Id: "t1", participant2Id: "t2", status: "COMPLETE" }),
      makeGame("sf2", { participant1Id: "t3", participant2Id: "t4", status: "COMPLETE" }),
      makeGame("final", {
        participant1Id: "t1",
        participant2Id: "t3",
        status: "COMPLETE",
        scoreParticipant1: 2,
        scoreParticipant2: 1,
        feederMatch1Id: "sf1",
        feederMatch2Id: "sf2",
      }),
    ];

    const result = getGamesToClear("sf1", games);

    expect(result).toHaveLength(1);
    expect(result[0].clearScores).toBe(true);
  });

  it("cascades through multiple levels", () => {
    const games = [
      makeGame("qf1", { participant1Id: "t1", participant2Id: "t2", status: "COMPLETE" }),
      makeGame("qf2", { participant1Id: "t3", participant2Id: "t4", status: "COMPLETE" }),
      makeGame("sf1", {
        participant1Id: "t1",
        participant2Id: "t3",
        status: "COMPLETE",
        scoreParticipant1: 2,
        scoreParticipant2: 0,
        feederMatch1Id: "qf1",
        feederMatch2Id: "qf2",
      }),
      makeGame("final", {
        participant1Id: "t1",
        participant2Id: null,
        status: "PENDING",
        feederMatch1Id: "sf1",
      }),
    ];

    const result = getGamesToClear("qf1", games);

    expect(result).toHaveLength(2);

    const sfAction = result.find((a) => a.matchId === "sf1")!;
    expect(sfAction.clearTeam1).toBe(true);
    expect(sfAction.clearTeam2).toBe(false);
    expect(sfAction.clearScores).toBe(true);

    const finalAction = result.find((a) => a.matchId === "final")!;
    expect(finalAction.clearTeam1).toBe(true);
    expect(finalAction.clearScores).toBe(false);
  });
});
