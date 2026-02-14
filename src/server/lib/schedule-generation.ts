/**
 * Pure schedule auto-generation algorithm.
 * No DB calls -- takes game data in, returns slot assignments out.
 */

export interface ScheduleDay {
  date: string; // ISO date string e.g. "2025-03-15"
  startHour: number;
  endHour: number;
}

export interface Court {
  id: string;
  name: string;
}

export interface AutoScheduleConfig {
  gameDurationMinutes: number;
  breakBetweenMinutes: number;
  days: ScheduleDay[];
  courts: Court[];
}

export interface ScheduleGameInput {
  id: string;
  team1Id: string | null;
  team2Id: string | null;
  status: string;
  feederGame1Id: string | null;
  feederGame2Id: string | null;
}

export interface ScheduleAssignment {
  gameId: string;
  scheduledAt: string; // ISO datetime
  locationId: string;
  durationMinutes: number;
}

type ScheduleResult =
  | { success: true; assignments: ScheduleAssignment[] }
  | { success: false; error: string };

/**
 * Build time slots for a single day.
 * Each slot is `gameDurationMinutes` long with `breakBetweenMinutes` gaps.
 */
function buildTimeSlots(
  day: ScheduleDay,
  gameDurationMinutes: number,
  breakBetweenMinutes: number
): Date[] {
  const slots: Date[] = [];
  const stepMinutes = gameDurationMinutes + breakBetweenMinutes;
  const dayDate = new Date(day.date + "T00:00:00");

  let currentMinutes = day.startHour * 60;
  const endMinutes = day.endHour * 60;

  while (currentMinutes + gameDurationMinutes <= endMinutes) {
    const slotDate = new Date(dayDate);
    slotDate.setMinutes(slotDate.getMinutes() + currentMinutes);
    slots.push(slotDate);
    currentMinutes += stepMinutes;
  }

  return slots;
}

/**
 * Topological sort of games by feeder dependencies (Kahn's algorithm).
 * Games with no feeders come first; downstream games follow their feeders.
 */
function topologicalSort(games: ScheduleGameInput[]): ScheduleGameInput[] | null {
  const gameMap = new Map(games.map((g) => [g.id, g]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const g of games) {
    if (!inDegree.has(g.id)) inDegree.set(g.id, 0);
    if (!adjacency.has(g.id)) adjacency.set(g.id, []);
  }

  // Build edges: feeder -> downstream
  for (const g of games) {
    if (g.feederGame1Id && gameMap.has(g.feederGame1Id)) {
      adjacency.get(g.feederGame1Id)!.push(g.id);
      inDegree.set(g.id, (inDegree.get(g.id) ?? 0) + 1);
    }
    if (g.feederGame2Id && gameMap.has(g.feederGame2Id)) {
      adjacency.get(g.feederGame2Id)!.push(g.id);
      inDegree.set(g.id, (inDegree.get(g.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: ScheduleGameInput[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(gameMap.get(id)!);
    for (const next of adjacency.get(id) ?? []) {
      const newDeg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  if (sorted.length !== games.length) return null; // cycle detected
  return sorted;
}

/**
 * Check if a game is a completed bye (one team null, already completed).
 */
function isCompletedBye(game: ScheduleGameInput): boolean {
  if (game.status !== "COMPLETED" && game.status !== "FORFEIT") return false;
  return game.team1Id === null || game.team2Id === null;
}

export function generateSchedule(
  games: ScheduleGameInput[],
  config: AutoScheduleConfig
): ScheduleResult {
  if (config.courts.length === 0) {
    return { success: false, error: "At least one court is required" };
  }
  if (config.days.length === 0) {
    return { success: false, error: "At least one day is required" };
  }

  // Filter out completed byes -- they don't need scheduling
  const schedulable = games.filter((g) => !isCompletedBye(g));

  if (schedulable.length === 0) {
    return { success: true, assignments: [] };
  }

  // Topological sort to respect feeder ordering
  const sorted = topologicalSort(schedulable);
  if (!sorted) {
    return { success: false, error: "Circular dependency detected in game feeders" };
  }

  // Build all available slots across all days and courts
  // Structure: flat list of { date, courtId, slotTime } ordered by time then court
  type SlotKey = string; // "ISO_datetime|courtId"
  const allSlots: { time: Date; courtId: string; key: SlotKey }[] = [];

  for (const day of config.days) {
    const timeSlots = buildTimeSlots(
      day,
      config.gameDurationMinutes,
      config.breakBetweenMinutes
    );
    for (const time of timeSlots) {
      for (const court of config.courts) {
        allSlots.push({
          time,
          courtId: court.id,
          key: `${time.toISOString()}|${court.id}`,
        });
      }
    }
  }

  // Sort slots chronologically, then by court
  allSlots.sort((a, b) => a.time.getTime() - b.time.getTime());

  // Track which slots are taken (by court) and which time slots have a given team
  const courtSlotUsed = new Set<SlotKey>();
  const teamTimeUsed = new Map<string, Set<number>>(); // teamId -> Set<timestamp>

  // Track when each game is scheduled (for feeder ordering validation)
  const gameScheduledTime = new Map<string, number>(); // gameId -> timestamp

  const assignments: ScheduleAssignment[] = [];

  for (const game of sorted) {
    // Find the earliest feeder completion time
    let earliestStart = 0;
    if (game.feederGame1Id && gameScheduledTime.has(game.feederGame1Id)) {
      const feederTime = gameScheduledTime.get(game.feederGame1Id)!;
      earliestStart = Math.max(
        earliestStart,
        feederTime + config.gameDurationMinutes * 60 * 1000
      );
    }
    if (game.feederGame2Id && gameScheduledTime.has(game.feederGame2Id)) {
      const feederTime = gameScheduledTime.get(game.feederGame2Id)!;
      earliestStart = Math.max(
        earliestStart,
        feederTime + config.gameDurationMinutes * 60 * 1000
      );
    }

    let placed = false;

    for (const slot of allSlots) {
      const slotTime = slot.time.getTime();

      // Must be after feeder games complete
      if (slotTime < earliestStart) continue;

      // Court must be free
      if (courtSlotUsed.has(slot.key)) continue;

      // Teams must not already be playing at this time
      const team1Busy =
        game.team1Id &&
        teamTimeUsed.get(game.team1Id)?.has(slotTime);
      const team2Busy =
        game.team2Id &&
        teamTimeUsed.get(game.team2Id)?.has(slotTime);
      if (team1Busy || team2Busy) continue;

      // Place the game
      courtSlotUsed.add(slot.key);
      if (game.team1Id) {
        if (!teamTimeUsed.has(game.team1Id))
          teamTimeUsed.set(game.team1Id, new Set());
        teamTimeUsed.get(game.team1Id)!.add(slotTime);
      }
      if (game.team2Id) {
        if (!teamTimeUsed.has(game.team2Id))
          teamTimeUsed.set(game.team2Id, new Set());
        teamTimeUsed.get(game.team2Id)!.add(slotTime);
      }
      gameScheduledTime.set(game.id, slotTime);

      assignments.push({
        gameId: game.id,
        scheduledAt: slot.time.toISOString(),
        locationId: slot.courtId,
        durationMinutes: config.gameDurationMinutes,
      });

      placed = true;
      break;
    }

    if (!placed) {
      const totalSlots = allSlots.length / config.courts.length;
      const totalCapacity = totalSlots * config.courts.length;
      return {
        success: false,
        error:
          `Could not schedule all games. ${assignments.length} of ${sorted.length} games placed. ` +
          `Available capacity: ${totalCapacity} slots across ${config.courts.length} court(s) and ${config.days.length} day(s). ` +
          `Try adding more courts, extending hours, or adding more days.`,
      };
    }
  }

  return { success: true, assignments };
}
