import { describe, it, expect } from "vitest";
import {
  generateSchedule,
  type AutoScheduleConfig,
  type ScheduleGameInput,
} from "@/server/lib/schedule-generation";

function makeGame(
  id: string,
  overrides: Partial<ScheduleGameInput> = {}
): ScheduleGameInput {
  return {
    id,
    team1Id: `team-${id}-1`,
    team2Id: `team-${id}-2`,
    status: "SCHEDULED",
    feederGame1Id: null,
    feederGame2Id: null,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<AutoScheduleConfig> = {}): AutoScheduleConfig {
  return {
    gameDurationMinutes: 30,
    breakBetweenMinutes: 10,
    days: [{ date: "2025-03-15", startHour: 8, endHour: 20 }],
    courts: [
      { id: "court-1", name: "Court 1" },
      { id: "court-2", name: "Court 2" },
    ],
    ...overrides,
  };
}

describe("generateSchedule", () => {
  it("schedules 4 games on 2 courts in 1 day", () => {
    const games = [makeGame("g1"), makeGame("g2"), makeGame("g3"), makeGame("g4")];
    const config = makeConfig();

    const result = generateSchedule(games, config);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.assignments).toHaveLength(4);

    // All games should have unique court+time combinations
    const keys = result.assignments.map((a) => `${a.scheduledAt}|${a.locationId}`);
    expect(new Set(keys).size).toBe(4);
  });

  it("respects feeder ordering -- downstream games come after feeders", () => {
    // Simulate a 4-team single elim: 2 semis feed 1 final
    const games = [
      makeGame("sf1", { team1Id: "t1", team2Id: "t2" }),
      makeGame("sf2", { team1Id: "t3", team2Id: "t4" }),
      makeGame("final", {
        team1Id: null,
        team2Id: null,
        feederGame1Id: "sf1",
        feederGame2Id: "sf2",
      }),
    ];
    const config = makeConfig({ courts: [{ id: "c1", name: "Court 1" }] });

    const result = generateSchedule(games, config);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.assignments).toHaveLength(3);

    const sf1Time = new Date(
      result.assignments.find((a) => a.gameId === "sf1")!.scheduledAt
    ).getTime();
    const sf2Time = new Date(
      result.assignments.find((a) => a.gameId === "sf2")!.scheduledAt
    ).getTime();
    const finalTime = new Date(
      result.assignments.find((a) => a.gameId === "final")!.scheduledAt
    ).getTime();

    expect(finalTime).toBeGreaterThan(sf1Time);
    expect(finalTime).toBeGreaterThan(sf2Time);
  });

  it("prevents same team from playing in the same time slot", () => {
    // Two games share team "shared-t": team conflict
    const games = [
      makeGame("g1", { team1Id: "shared-t", team2Id: "t2" }),
      makeGame("g2", { team1Id: "shared-t", team2Id: "t3" }),
    ];
    const config = makeConfig();

    const result = generateSchedule(games, config);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const g1 = result.assignments.find((a) => a.gameId === "g1")!;
    const g2 = result.assignments.find((a) => a.gameId === "g2")!;
    // They should be at different times
    expect(g1.scheduledAt).not.toBe(g2.scheduledAt);
  });

  it("returns error when more games than available slots", () => {
    // 1 court, 1 hour window, 30min games + 10min break = 1 slot
    const games = [makeGame("g1"), makeGame("g2")];
    const config = makeConfig({
      courts: [{ id: "c1", name: "Court 1" }],
      days: [{ date: "2025-03-15", startHour: 8, endHour: 8.5 }],
    });

    const result = generateSchedule(games, config);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Could not schedule all games");
  });

  it("spills games to day 2 when day 1 overflows", () => {
    // 1 court, 1 slot per day, 2 days, 2 games
    const games = [makeGame("g1"), makeGame("g2")];
    const config = makeConfig({
      courts: [{ id: "c1", name: "Court 1" }],
      days: [
        { date: "2025-03-15", startHour: 8, endHour: 8.5 },
        { date: "2025-03-16", startHour: 8, endHour: 8.5 },
      ],
    });

    const result = generateSchedule(games, config);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.assignments).toHaveLength(2);

    const dates = result.assignments.map(
      (a) => new Date(a.scheduledAt).toISOString().split("T")[0]
    );
    expect(dates).toContain("2025-03-15");
    expect(dates).toContain("2025-03-16");
  });

  it("excludes completed bye games from scheduling", () => {
    const games = [
      makeGame("bye", {
        team1Id: "t1",
        team2Id: null,
        status: "COMPLETED",
      }),
      makeGame("real", { team1Id: "t2", team2Id: "t3" }),
    ];
    const config = makeConfig();

    const result = generateSchedule(games, config);

    expect(result.success).toBe(true);
    if (!result.success) return;
    // Only the non-bye game should be scheduled
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].gameId).toBe("real");
  });

  it("returns error with no courts", () => {
    const result = generateSchedule([makeGame("g1")], makeConfig({ courts: [] }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("court");
  });

  it("returns error with no days", () => {
    const result = generateSchedule([makeGame("g1")], makeConfig({ days: [] }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("day");
  });

  it("returns empty assignments for zero schedulable games", () => {
    // All games are completed byes
    const games = [
      makeGame("bye1", { team1Id: "t1", team2Id: null, status: "COMPLETED" }),
      makeGame("bye2", { team1Id: null, team2Id: "t2", status: "COMPLETED" }),
    ];

    const result = generateSchedule(games, makeConfig());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.assignments).toHaveLength(0);
  });
});
