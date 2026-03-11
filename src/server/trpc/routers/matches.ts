import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  baseProcedure,
  protectedProcedure,
  createTRPCRouter,
} from "../init";
import { verifyTournamentOwnership } from "../helpers";
import { calculateStandings } from "@/server/lib/standings";
import { emitToTournament } from "@/lib/socket";
import {
  validateMatchScores,
  type ScoringConfig,
  type SetScore,
  DEFAULT_SCORING_CONFIG,
} from "@/server/lib/scoring-validation";
import { stripUndefined } from "@/lib/utils";
import { generateSchedule } from "@/server/lib/schedule-generation";
import { analyzeCascade, getGamesToClear } from "@/server/lib/bracket-cascade";
import { getBracketRoundLabel } from "@/lib/bracket-layout";

async function fetchBracketData(prisma: PrismaClient, tournamentId: string) {
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    orderBy: { roundPosition: "asc" },
    include: {
      participant1: { select: { id: true, name: true, seed: true } },
      participant2: { select: { id: true, name: true, seed: true } },
      location: { select: { id: true, name: true } },
    },
  });

  if (matches.length === 0) {
    return { rounds: [], totalRounds: 0, games: [] };
  }

  // Compute bracket round for each game by traversing feeder chains
  const depthCache = new Map<string, number>();

  function getDepth(matchId: string): number {
    if (depthCache.has(matchId)) return depthCache.get(matchId)!;
    const match = matches.find((m) => m.id === matchId);
    if (!match) return 0;
    if (!match.feederMatch1Id && !match.feederMatch2Id) {
      depthCache.set(matchId, 0);
      return 0;
    }
    const d1 = match.feederMatch1Id ? getDepth(match.feederMatch1Id) : -1;
    const d2 = match.feederMatch2Id ? getDepth(match.feederMatch2Id) : -1;
    const depth = Math.max(d1, d2) + 1;
    depthCache.set(matchId, depth);
    return depth;
  }

  // Compute depths for all matches
  for (const match of matches) {
    getDepth(match.id);
  }

  const totalRounds = Math.max(...Array.from(depthCache.values())) + 1;

  // Group matches by bracket round
  const roundsMap = new Map<number, typeof matches>();
  for (const match of matches) {
    const depth = depthCache.get(match.id) ?? 0;
    if (!roundsMap.has(depth)) roundsMap.set(depth, []);
    roundsMap.get(depth)!.push(match);
  }

  const rounds = Array.from({ length: totalRounds }, (_, i) => ({
    index: i,
    label: getBracketRoundLabel(i, totalRounds),
    games: (roundsMap.get(i) ?? []).map((m) => ({
      id: m.id,
      roundPosition: m.roundPosition,
      status: m.status,
      participant1: m.participant1,
      participant2: m.participant2,
      scoreParticipant1: m.scoreParticipant1,
      scoreParticipant2: m.scoreParticipant2,
      setScores: m.setScores as { team1: number; team2: number }[] | null,
      feederMatch1Id: m.feederMatch1Id,
      feederMatch2Id: m.feederMatch2Id,
      location: m.location,
      scheduledAt: m.scheduledAt,
      matchType: m.matchType,
    })),
  }));

  return { rounds, totalRounds, games: matches.map((m) => m.id) };
}

async function advanceWinner(
  tx: Prisma.TransactionClient,
  matchId: string,
  winnerId: string
): Promise<void> {
  const nextMatches = await tx.match.findMany({
    where: { OR: [{ feederMatch1Id: matchId }, { feederMatch2Id: matchId }] },
  });
  for (const next of nextMatches) {
    if (next.feederMatch1Id === matchId) {
      await tx.match.update({ where: { id: next.id }, data: { participant1Id: winnerId } });
    }
    if (next.feederMatch2Id === matchId) {
      await tx.match.update({ where: { id: next.id }, data: { participant2Id: winnerId } });
    }
  }
}

export const matchesRouter = createTRPCRouter({
  listByTournament: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        status: z.enum(["PENDING", "OPEN", "COMPLETE", "FORFEIT"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return ctx.prisma.match.findMany({
        where: {
          tournamentId: input.tournamentId,
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: [{ scheduledAt: "asc" }, { roundPosition: "asc" }],
        include: {
          participant1: { select: { id: true, name: true } },
          participant2: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      });
    }),

  listByTournamentPublic: baseProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        date: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const dateFilter = input.date
        ? {
            scheduledAt: {
              gte: new Date(input.date),
              lt: new Date(
                new Date(input.date).getTime() + 24 * 60 * 60 * 1000
              ),
            },
          }
        : {};

      return ctx.prisma.match.findMany({
        where: {
          tournamentId: input.tournamentId,
          tournament: { deletedAt: null },
          ...dateFilter,
        },
        orderBy: [{ scheduledAt: "asc" }, { roundPosition: "asc" }],
        include: {
          participant1: { select: { id: true, name: true } },
          participant2: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      });
    }),

  updateScore: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        tournamentId: z.string(),
        setScores: z.array(
          z.object({
            team1: z.number().int().min(0),
            team2: z.number().int().min(0),
          })
        ),
        confirmCascade: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      // Fetch tournament's scoring config
      const tournament = await ctx.prisma.tournament.findFirst({
        where: { id: input.tournamentId },
        select: { scoringConfig: true },
      });
      const scoringConfig = (tournament?.scoringConfig as unknown as ScoringConfig) ?? DEFAULT_SCORING_CONFIG;

      // Validate set scores
      const validation = validateMatchScores(input.setScores as SetScore[], scoringConfig);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.error ?? "Invalid scores",
        });
      }

      // Fetch current match state (used for winner derivation + cascade check)
      const currentMatch = await ctx.prisma.match.findUnique({
        where: { id: input.id },
        include: { tournament: { select: { format: true } } },
      });
      if (!currentMatch) throw new TRPCError({ code: "NOT_FOUND" });

      const newWinnerId =
        validation.setsWon.team1 > validation.setsWon.team2
          ? currentMatch.participant1Id
          : currentMatch.participant2Id;

      const isBracket = currentMatch.tournament.format === "SINGLE_ELIM" || currentMatch.tournament.format === "DOUBLE_ELIM";

      // Determine old winner (if match was already completed)
      let oldWinnerId: string | null = null;
      if (currentMatch.status === "COMPLETE" || currentMatch.status === "FORFEIT") {
        if (currentMatch.scoreParticipant1 !== null && currentMatch.scoreParticipant2 !== null) {
          oldWinnerId = currentMatch.scoreParticipant1 > currentMatch.scoreParticipant2
            ? currentMatch.participant1Id
            : currentMatch.participant2Id;
        }
      }

      // Cascade check for bracket games with winner change
      if (isBracket && oldWinnerId !== null && oldWinnerId !== newWinnerId) {
        const allMatches = await ctx.prisma.match.findMany({
          where: { tournamentId: currentMatch.tournamentId },
          select: {
            id: true, participant1Id: true, participant2Id: true,
            status: true, scoreParticipant1: true, scoreParticipant2: true,
            feederMatch1Id: true, feederMatch2Id: true,
          },
        });

        const cascadeInput = allMatches.map((m) => ({
          id: m.id,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          status: m.status,
          scoreParticipant1: m.scoreParticipant1,
          scoreParticipant2: m.scoreParticipant2,
          feederMatch1Id: m.feederMatch1Id,
          feederMatch2Id: m.feederMatch2Id,
        }));

        const cascade = analyzeCascade(input.id, oldWinnerId, newWinnerId, cascadeInput);

        if (cascade.scoredDownstreamGames.length > 0 && !input.confirmCascade) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Score edit affects downstream bracket games",
            cause: {
              type: "CASCADE_REQUIRED",
              downstreamCount: cascade.downstreamGames.length,
              scoredCount: cascade.scoredDownstreamGames.length,
            },
          });
        }

        // Execute cascade in transaction
        const clearActions = getGamesToClear(input.id, cascadeInput);

        await ctx.prisma.$transaction(async (tx) => {
          // Update the edited match's score
          await tx.match.update({
            where: { id: input.id },
            data: {
              setScores: input.setScores,
              scoreParticipant1: validation.setsWon.team1,
              scoreParticipant2: validation.setsWon.team2,
              status: "COMPLETE",
            },
          });

          // Clear downstream matches
          for (const action of clearActions) {
            const clearData: Record<string, unknown> = {};
            if (action.clearTeam1) clearData.participant1Id = null;
            if (action.clearTeam2) clearData.participant2Id = null;
            if (action.clearScores) {
              clearData.scoreParticipant1 = null;
              clearData.scoreParticipant2 = null;
              clearData.setScores = Prisma.DbNull;
              clearData.status = "PENDING";
            }
            await tx.match.update({ where: { id: action.matchId }, data: clearData });
          }

          // Re-advance new winner to immediate downstream matches
          await advanceWinner(tx, input.id, newWinnerId!);
        });
      } else {
        // No cascade needed -- simple update + advance (in transaction)
        await ctx.prisma.$transaction(async (tx) => {
          await tx.match.update({
            where: { id: input.id },
            data: {
              setScores: input.setScores,
              scoreParticipant1: validation.setsWon.team1,
              scoreParticipant2: validation.setsWon.team2,
              status: "COMPLETE",
            },
          });

          if (isBracket) {
            await advanceWinner(tx, input.id, newWinnerId!);
          }
        });
      }

      const updatedMatch = await ctx.prisma.match.findUnique({
        where: { id: input.id },
      });

      emitToTournament(input.tournamentId, "score:updated", {
        matchId: input.id,
        scoreParticipant1: validation.setsWon.team1,
        scoreParticipant2: validation.setsWon.team2,
        status: "COMPLETE",
      });

      return updatedMatch;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        tournamentId: z.string(),
        status: z.enum(["PENDING", "OPEN", "COMPLETE", "FORFEIT"]),
        forfeitWinnerId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const data: Record<string, unknown> = { status: input.status };

      if (input.status === "FORFEIT" && input.forfeitWinnerId) {
        const match = await ctx.prisma.match.findUnique({
          where: { id: input.id },
        });
        if (!match) throw new TRPCError({ code: "NOT_FOUND" });

        if (input.forfeitWinnerId === match.participant1Id) {
          data.scoreParticipant1 = 1;
          data.scoreParticipant2 = 0;
        } else {
          data.scoreParticipant1 = 0;
          data.scoreParticipant2 = 1;
        }
      }

      const updated = await ctx.prisma.$transaction(async (tx) => {
        const result = await tx.match.update({
          where: { id: input.id },
          data,
          include: { tournament: { select: { format: true } } },
        });

        // Advance forfeit winner in bracket tournaments
        if (
          input.status === "FORFEIT" &&
          input.forfeitWinnerId &&
          (result.tournament.format === "SINGLE_ELIM" || result.tournament.format === "DOUBLE_ELIM")
        ) {
          await advanceWinner(tx, input.id, input.forfeitWinnerId);
        }

        return result;
      });

      emitToTournament(input.tournamentId, "score:updated", {
        matchId: updated.id,
        scoreParticipant1: updated.scoreParticipant1,
        scoreParticipant2: updated.scoreParticipant2,
        status: updated.status,
      });

      return updated;
    }),

  updateSchedule: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        tournamentId: z.string(),
        scheduledAt: z.string().optional(),
        locationId: z.string().nullable().optional(),
        durationMinutes: z.number().int().min(1).optional(),
        matchType: z.enum(["SINGLES", "DOUBLES"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const data = stripUndefined({
        scheduledAt: input.scheduledAt !== undefined ? new Date(input.scheduledAt) : undefined,
        locationId: input.locationId,
        durationMinutes: input.durationMinutes,
        matchType: input.matchType,
      });

      const updated = await ctx.prisma.match.update({
        where: { id: input.id },
        data,
      });

      emitToTournament(input.tournamentId, "schedule:updated", {
        matchId: updated.id,
        scheduledAt: updated.scheduledAt,
        locationId: updated.locationId,
      });

      return updated;
    }),

  batchUpdateSchedule: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        updates: z.array(
          z.object({
            matchId: z.string(),
            scheduledAt: z.string().optional(),
            locationId: z.string().nullable().optional(),
            durationMinutes: z.number().int().min(1).optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const results = await ctx.prisma.$transaction(
        input.updates.map((update) => {
          const data: Record<string, unknown> = {};
          if (update.scheduledAt !== undefined)
            data.scheduledAt = update.scheduledAt ? new Date(update.scheduledAt) : null;
          if (update.locationId !== undefined)
            data.locationId = update.locationId;
          if (update.durationMinutes !== undefined)
            data.durationMinutes = update.durationMinutes;

          return ctx.prisma.match.update({
            where: { id: update.matchId },
            data,
          });
        })
      );

      emitToTournament(input.tournamentId, "schedule:updated", {
        batchUpdate: true,
        count: results.length,
      });

      return { updated: results.length };
    }),

  resetScore: protectedProcedure
    .input(z.object({
      id: z.string(),
      tournamentId: z.string(),
      confirmCascade: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const match = await ctx.prisma.match.findUnique({
        where: { id: input.id },
        include: { tournament: { select: { format: true } } },
      });
      if (!match) throw new TRPCError({ code: "NOT_FOUND" });

      const isBracket = match.tournament.format === "SINGLE_ELIM" || match.tournament.format === "DOUBLE_ELIM";

      if (isBracket) {
        const allMatches = await ctx.prisma.match.findMany({
          where: { tournamentId: match.tournamentId },
          select: {
            id: true, participant1Id: true, participant2Id: true,
            status: true, scoreParticipant1: true, scoreParticipant2: true,
            feederMatch1Id: true, feederMatch2Id: true,
          },
        });

        const cascadeInput = allMatches.map((m) => ({
          id: m.id,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          status: m.status,
          scoreParticipant1: m.scoreParticipant1,
          scoreParticipant2: m.scoreParticipant2,
          feederMatch1Id: m.feederMatch1Id,
          feederMatch2Id: m.feederMatch2Id,
        }));

        const clearActions = getGamesToClear(input.id, cascadeInput);
        const scoredDownstream = clearActions.filter((a) => a.clearScores);

        if (scoredDownstream.length > 0 && !input.confirmCascade) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Score reset affects downstream bracket games",
            cause: {
              type: "CASCADE_REQUIRED",
              downstreamCount: clearActions.length,
              scoredCount: scoredDownstream.length,
            },
          });
        }

        await ctx.prisma.$transaction(async (tx) => {
          // Reset the edited match
          await tx.match.update({
            where: { id: input.id },
            data: {
              scoreParticipant1: null,
              scoreParticipant2: null,
              setScores: Prisma.DbNull,
              status: "PENDING",
            },
          });

          // Clear downstream participant slots and scores
          for (const action of clearActions) {
            const clearData: Record<string, unknown> = {};
            if (action.clearTeam1) clearData.participant1Id = null;
            if (action.clearTeam2) clearData.participant2Id = null;
            if (action.clearScores) {
              clearData.scoreParticipant1 = null;
              clearData.scoreParticipant2 = null;
              clearData.setScores = Prisma.DbNull;
              clearData.status = "PENDING";
            }
            await tx.match.update({ where: { id: action.matchId }, data: clearData });
          }
        });
      } else {
        await ctx.prisma.match.update({
          where: { id: input.id },
          data: {
            scoreParticipant1: null,
            scoreParticipant2: null,
            setScores: Prisma.DbNull,
            status: "PENDING",
          },
        });
      }

      emitToTournament(input.tournamentId, "score:updated", {
        matchId: input.id,
        scoreParticipant1: null,
        scoreParticipant2: null,
        status: "PENDING",
      });

      return ctx.prisma.match.findUnique({ where: { id: input.id } });
    }),

  autoSchedule: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        config: z.object({
          gameDurationMinutes: z.number().int().min(5).max(300),
          breakBetweenMinutes: z.number().int().min(0).max(120),
          dayStartHour: z.number().min(0).max(23),
          dayEndHour: z.number().min(1).max(24),
        }),
        clearExisting: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tournament = await verifyTournamentOwnership(
        ctx.prisma, input.tournamentId, ctx.userId
      );

      // Validate tournament has dates
      if (!tournament.startDate || !tournament.endDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tournament must have start and end dates for auto-scheduling",
        });
      }

      // Fetch courts (locations)
      const locations = await ctx.prisma.location.findMany({
        where: { tournamentId: input.tournamentId },
      });
      if (locations.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tournament must have at least one court/location",
        });
      }

      // Fetch all matches
      const allMatches = await ctx.prisma.match.findMany({
        where: { tournamentId: input.tournamentId },
        select: {
          id: true, participant1Id: true, participant2Id: true,
          status: true, feederMatch1Id: true, feederMatch2Id: true,
        },
      });
      if (allMatches.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No matches to schedule. Generate matches first.",
        });
      }

      // Build days from tournament date range
      const days = [];
      const start = new Date(tournament.startDate);
      const end = new Date(tournament.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push({
          date: d.toISOString().split("T")[0],
          startHour: input.config.dayStartHour,
          endHour: input.config.dayEndHour,
        });
      }

      const result = generateSchedule(
        allMatches.map((m) => ({
          id: m.id,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          status: m.status,
          feederMatch1Id: m.feederMatch1Id,
          feederMatch2Id: m.feederMatch2Id,
        })),
        {
          gameDurationMinutes: input.config.gameDurationMinutes,
          breakBetweenMinutes: input.config.breakBetweenMinutes,
          days,
          courts: locations.map((l) => ({ id: l.id, name: l.name })),
        }
      );

      if (!result.success) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: result.error,
        });
      }

      await ctx.prisma.$transaction(async (tx) => {
        // Optionally clear existing schedule
        if (input.clearExisting) {
          await tx.match.updateMany({
            where: { tournamentId: input.tournamentId },
            data: { scheduledAt: null, locationId: null },
          });
        }

        // Batch-update matches with assignments sequentially to avoid pool exhaustion
        for (const a of result.assignments) {
          await tx.match.update({
            where: { id: a.matchId },
            data: {
              scheduledAt: new Date(a.scheduledAt),
              locationId: a.locationId,
              durationMinutes: a.durationMinutes,
            },
          });
        }
      });

      emitToTournament(input.tournamentId, "schedule:updated", {
        batchUpdate: true,
        count: result.assignments.length,
      });

      return { scheduled: result.assignments.length };
    }),

  getBracketData: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return fetchBracketData(ctx.prisma, input.tournamentId);
    }),

  getBracketDataPublic: baseProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tournament = await ctx.prisma.tournament.findFirst({
        where: { id: input.tournamentId, deletedAt: null },
        select: { status: true },
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      if (tournament.status === "PENDING") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tournament is not published" });
      }
      return fetchBracketData(ctx.prisma, input.tournamentId);
    }),

  getStandings: baseProcedure
    .input(
      z.object({
        tournamentId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tournament = await ctx.prisma.tournament.findFirst({
        where: { id: input.tournamentId, deletedAt: null },
        select: { status: true, pointsConfig: true, tiebreakerConfig: true },
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      if (tournament.status === "PENDING") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tournament is not published" });
      }

      const matches = await ctx.prisma.match.findMany({
        where: { tournamentId: input.tournamentId },
        include: {
          participant1: { select: { id: true, name: true } },
          participant2: { select: { id: true, name: true } },
        },
      });

      const pointsConfig = tournament.pointsConfig as {
        win: number;
        draw: number;
        loss: number;
      };
      const tiebreakerConfig = tournament.tiebreakerConfig as {
        order: string[];
      };

      return calculateStandings(matches, pointsConfig, tiebreakerConfig);
    }),
});
