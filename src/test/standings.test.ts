import { describe, it, expect } from "vitest";
import { calculateStandings } from "@/server/lib/standings";

function makeGame(
  p1Id: string,
  p2Id: string,
  score1: number,
  score2: number,
  status = "COMPLETE"
) {
  return {
    participant1Id: p1Id,
    participant2Id: p2Id,
    scoreParticipant1: score1,
    scoreParticipant2: score2,
    status,
    participant1: { id: p1Id, name: p1Id },
    participant2: { id: p2Id, name: p2Id },
  };
}

describe("calculateStandings — basic accumulation", () => {
  it("returns empty array for no games", () => {
    expect(calculateStandings([])).toEqual([]);
  });

  it("skips PENDING and OPEN games", () => {
    const games = [
      makeGame("a", "b", 21, 15, "PENDING"),
      makeGame("a", "b", 21, 15, "OPEN"),
    ];
    expect(calculateStandings(games)).toEqual([]);
  });

  it("includes FORFEIT games", () => {
    const games = [makeGame("a", "b", 21, 0, "FORFEIT")];
    const standings = calculateStandings(games);
    expect(standings).toHaveLength(2);
    expect(standings[0].participantId).toBe("a");
    expect(standings[0].wins).toBe(1);
  });

  it("skips games with null participant ids", () => {
    const games = [
      {
        participant1Id: null,
        participant2Id: "b",
        scoreParticipant1: 21,
        scoreParticipant2: 15,
        status: "COMPLETE",
      },
    ];
    expect(calculateStandings(games)).toEqual([]);
  });

  it("skips games with null scores", () => {
    const games = [
      {
        participant1Id: "a",
        participant2Id: "b",
        scoreParticipant1: null,
        scoreParticipant2: null,
        status: "COMPLETE",
      },
    ];
    expect(calculateStandings(games)).toEqual([]);
  });

  it("accumulates wins, losses, and draws for a 3-team round robin", () => {
    // a beats b, a beats c, b beats c
    const games = [
      makeGame("a", "b", 21, 15),
      makeGame("a", "c", 21, 10),
      makeGame("b", "c", 21, 18),
    ];
    const standings = calculateStandings(games);
    const byId = Object.fromEntries(standings.map((s) => [s.participantId, s]));

    expect(byId["a"].wins).toBe(2);
    expect(byId["a"].losses).toBe(0);
    expect(byId["b"].wins).toBe(1);
    expect(byId["b"].losses).toBe(1);
    expect(byId["c"].wins).toBe(0);
    expect(byId["c"].losses).toBe(2);
  });

  it("counts draws correctly", () => {
    const games = [makeGame("a", "b", 15, 15)];
    const standings = calculateStandings(games);
    const byId = Object.fromEntries(standings.map((s) => [s.participantId, s]));
    expect(byId["a"].draws).toBe(1);
    expect(byId["b"].draws).toBe(1);
    expect(byId["a"].wins).toBe(0);
    expect(byId["b"].wins).toBe(0);
  });

  it("uses pointsConfig (win=3, draw=1, loss=0)", () => {
    const games = [makeGame("a", "b", 21, 15)];
    const standings = calculateStandings(games, { win: 3, draw: 1, loss: 0 });
    const byId = Object.fromEntries(standings.map((s) => [s.participantId, s]));
    expect(byId["a"].standingPoints).toBe(3);
    expect(byId["b"].standingPoints).toBe(0);
  });

  it("uses default pointsConfig (win=2, draw=1, loss=0)", () => {
    const games = [makeGame("a", "b", 21, 15)];
    const standings = calculateStandings(games);
    const byId = Object.fromEntries(standings.map((s) => [s.participantId, s]));
    expect(byId["a"].standingPoints).toBe(2);
    expect(byId["b"].standingPoints).toBe(0);
  });

  it("assigns 1-based ranks in order", () => {
    const games = [
      makeGame("a", "b", 21, 15),
      makeGame("a", "c", 21, 10),
      makeGame("b", "c", 21, 18),
    ];
    const standings = calculateStandings(games);
    expect(standings[0].rank).toBe(1);
    expect(standings[1].rank).toBe(2);
    expect(standings[2].rank).toBe(3);
  });

  it("tracks pointsFor, pointsAgainst, pointDifferential, and gamesPlayed", () => {
    const games = [makeGame("a", "b", 21, 15)];
    const standings = calculateStandings(games);
    const byId = Object.fromEntries(standings.map((s) => [s.participantId, s]));

    expect(byId["a"].pointsFor).toBe(21);
    expect(byId["a"].pointsAgainst).toBe(15);
    expect(byId["a"].pointDifferential).toBe(6);
    expect(byId["a"].gamesPlayed).toBe(1);

    expect(byId["b"].pointsFor).toBe(15);
    expect(byId["b"].pointsAgainst).toBe(21);
    expect(byId["b"].pointDifferential).toBe(-6);
    expect(byId["b"].gamesPlayed).toBe(1);
  });

  it("falls back to participantId when no participant object provided", () => {
    const games = [
      {
        participant1Id: "id-x",
        participant2Id: "id-y",
        scoreParticipant1: 21,
        scoreParticipant2: 15,
        status: "COMPLETE",
        // no participant1 / participant2 objects
      },
    ];
    const standings = calculateStandings(games);
    const byId = Object.fromEntries(standings.map((s) => [s.participantId, s]));
    expect(byId["id-x"].participantName).toBe("id-x");
    expect(byId["id-y"].participantName).toBe("id-y");
  });
});

describe("calculateStandings — tiebreakers", () => {
  it("win_loss separates teams by standing points", () => {
    // a: 2 wins, b: 1 win, c: 0 wins
    const games = [
      makeGame("a", "b", 21, 15),
      makeGame("a", "c", 21, 10),
      makeGame("b", "c", 21, 18),
    ];
    const standings = calculateStandings(games, undefined, { order: ["win_loss"] });
    expect(standings[0].participantId).toBe("a");
    expect(standings[1].participantId).toBe("b");
    expect(standings[2].participantId).toBe("c");
  });

  it("head_to_head breaks a win_loss tie", () => {
    // a and b both have 1 win, 1 loss; a beat b directly
    // a beats b, c beats a, b beats c — a and b both have 1W/1L
    const games = [
      makeGame("a", "b", 21, 15), // a beats b
      makeGame("c", "a", 21, 10), // c beats a
      makeGame("b", "c", 21, 18), // b beats c — all three: 1W/1L
    ];
    const standings = calculateStandings(games, undefined, {
      order: ["win_loss", "head_to_head"],
    });
    // All tied at 2 points; h2h: a beat b, so a > b
    const aIdx = standings.findIndex((s) => s.participantId === "a");
    const bIdx = standings.findIndex((s) => s.participantId === "b");
    expect(aIdx).toBeLessThan(bIdx);
  });

  it("point_differential breaks a tie", () => {
    // a and b both have 1 win; a won by more points
    const games = [
      makeGame("a", "c", 21, 5),  // a wins by 16
      makeGame("b", "c", 21, 19), // b wins by 2
    ];
    const standings = calculateStandings(games, undefined, {
      order: ["win_loss", "point_differential"],
    });
    expect(standings[0].participantId).toBe("a");
    expect(standings[1].participantId).toBe("b");
  });

  it("points_scored breaks a tie", () => {
    // a and b: same wins, same differential; a scored more
    const games = [
      makeGame("a", "c", 21, 11), // diff = 10, scored = 21
      makeGame("b", "d", 21, 11), // diff = 10, scored = 21 — same so far
      makeGame("a", "e", 20, 10), // a scored extra 20
      makeGame("b", "e", 15, 10), // b scored extra 15 (less than a)
    ];
    const standings = calculateStandings(games, undefined, {
      order: ["win_loss", "point_differential", "points_scored"],
    });
    expect(standings[0].participantId).toBe("a");
  });

  it("points_allowed breaks a tie (fewer is better)", () => {
    // a and b: same wins, same differential, same scored; a allowed fewer
    const games = [
      makeGame("a", "c", 21, 10), // against = 10
      makeGame("b", "d", 21, 15), // against = 15
    ];
    const standings = calculateStandings(games, undefined, {
      order: ["win_loss", "point_differential", "points_scored", "points_allowed"],
    });
    expect(standings[0].participantId).toBe("a");
    expect(standings[1].participantId).toBe("b");
  });
});
