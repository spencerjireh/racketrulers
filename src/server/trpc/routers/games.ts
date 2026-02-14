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

function getBracketRoundLabel(roundIndex: number, totalRounds: number): string {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinals";
  if (remaining === 3) return "Quarterfinals";
  return `Round ${roundIndex + 1}`;
}

async function fetchBracketData(prisma: PrismaClient, roundId: string) {
  const games = await prisma.game.findMany({
    where: { roundId },
    orderBy: { roundPosition: "asc" },
    include: {
      team1: { select: { id: true, name: true, seed: true } },
      team2: { select: { id: true, name: true, seed: true } },
      location: { select: { id: true, name: true } },
    },
  });

  if (games.length === 0) {
    return { rounds: [], totalRounds: 0, games: [] };
  }

  // Compute bracket round for each game by traversing feeder chains
  const depthCache = new Map<string, number>();

  function getDepth(gameId: string): number {
    if (depthCache.has(gameId)) return depthCache.get(gameId)!;
    const game = games.find((g) => g.id === gameId);
    if (!game) return 0;
    if (!game.feederGame1Id && !game.feederGame2Id) {
      depthCache.set(gameId, 0);
      return 0;
    }
    const d1 = game.feederGame1Id ? getDepth(game.feederGame1Id) : -1;
    const d2 = game.feederGame2Id ? getDepth(game.feederGame2Id) : -1;
    const depth = Math.max(d1, d2) + 1;
    depthCache.set(gameId, depth);
    return depth;
  }

  // Compute depths for all games
  for (const game of games) {
    getDepth(game.id);
  }

  const totalRounds = Math.max(...Array.from(depthCache.values())) + 1;

  // Group games by bracket round
  const roundsMap = new Map<number, typeof games>();
  for (const game of games) {
    const depth = depthCache.get(game.id) ?? 0;
    if (!roundsMap.has(depth)) roundsMap.set(depth, []);
    roundsMap.get(depth)!.push(game);
  }

  const rounds = Array.from({ length: totalRounds }, (_, i) => ({
    index: i,
    label: getBracketRoundLabel(i, totalRounds),
    games: (roundsMap.get(i) ?? []).map((g) => ({
      id: g.id,
      roundPosition: g.roundPosition,
      status: g.status,
      team1: g.team1,
      team2: g.team2,
      scoreTeam1: g.scoreTeam1,
      scoreTeam2: g.scoreTeam2,
      setScores: g.setScores as { team1: number; team2: number }[] | null,
      feederGame1Id: g.feederGame1Id,
      feederGame2Id: g.feederGame2Id,
      location: g.location,
      scheduledAt: g.scheduledAt,
      matchType: g.matchType,
    })),
  }));

  return { rounds, totalRounds, games: games.map((g) => g.id) };
}

export const gamesRouter = createTRPCRouter({
  listByRound: protectedProcedure
    .input(z.object({ roundId: z.string(), tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return ctx.prisma.game.findMany({
        where: { roundId: input.roundId },
        orderBy: { roundPosition: "asc" },
        include: {
          team1: { select: { id: true, name: true } },
          team2: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          pool: { select: { id: true, name: true } },
        },
      });
    }),

  listByTournament: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "FORFEIT", "CANCELLED"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return ctx.prisma.game.findMany({
        where: {
          round: { tournamentId: input.tournamentId },
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: [{ scheduledAt: "asc" }, { roundPosition: "asc" }],
        include: {
          team1: { select: { id: true, name: true } },
          team2: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          pool: { select: { id: true, name: true } },
          round: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      });
    }),

  listByTournamentPublic: baseProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        roundId: z.string().optional(),
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

      return ctx.prisma.game.findMany({
        where: {
          round: {
            tournamentId: input.tournamentId,
            tournament: { deletedAt: null },
            ...(input.roundId ? { id: input.roundId } : {}),
          },
          ...dateFilter,
        },
        orderBy: [{ scheduledAt: "asc" }, { roundPosition: "asc" }],
        include: {
          team1: { select: { id: true, name: true } },
          team2: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          pool: { select: { id: true, name: true } },
          round: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
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

      // Fetch current game state (used for winner derivation + cascade check)
      const currentGame = await ctx.prisma.game.findUnique({
        where: { id: input.id },
        include: { round: true },
      });
      if (!currentGame) throw new TRPCError({ code: "NOT_FOUND" });

      const newWinnerId =
        validation.setsWon.team1 > validation.setsWon.team2
          ? currentGame.team1Id
          : currentGame.team2Id;

      const isBracket = currentGame.round.type === "SINGLE_ELIM" || currentGame.round.type === "DOUBLE_ELIM";

      // Determine old winner (if game was already completed)
      let oldWinnerId: string | null = null;
      if (currentGame.status === "COMPLETED" || currentGame.status === "FORFEIT") {
        if (currentGame.scoreTeam1 !== null && currentGame.scoreTeam2 !== null) {
          oldWinnerId = currentGame.scoreTeam1 > currentGame.scoreTeam2
            ? currentGame.team1Id
            : currentGame.team2Id;
        }
      }

      // Cascade check for bracket games with winner change
      if (isBracket && oldWinnerId !== null && oldWinnerId !== newWinnerId) {
        const allGames = await ctx.prisma.game.findMany({
          where: { roundId: currentGame.roundId },
          select: {
            id: true, team1Id: true, team2Id: true,
            status: true, scoreTeam1: true, scoreTeam2: true,
            feederGame1Id: true, feederGame2Id: true,
          },
        });

        const cascade = analyzeCascade(input.id, oldWinnerId, newWinnerId, allGames);

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
        const clearActions = getGamesToClear(input.id, allGames);

        await ctx.prisma.$transaction(async (tx) => {
          // Update the edited game's score
          await tx.game.update({
            where: { id: input.id },
            data: {
              setScores: input.setScores,
              scoreTeam1: validation.setsWon.team1,
              scoreTeam2: validation.setsWon.team2,
              status: "COMPLETED",
            },
          });

          // Clear downstream games
          for (const action of clearActions) {
            const clearData: Record<string, unknown> = {};
            if (action.clearTeam1) clearData.team1Id = null;
            if (action.clearTeam2) clearData.team2Id = null;
            if (action.clearScores) {
              clearData.scoreTeam1 = null;
              clearData.scoreTeam2 = null;
              clearData.setScores = Prisma.DbNull;
              clearData.status = "SCHEDULED";
            }
            await tx.game.update({ where: { id: action.gameId }, data: clearData });
          }

          // Re-advance new winner to immediate downstream games
          const nextGames = await tx.game.findMany({
            where: {
              OR: [
                { feederGame1Id: input.id },
                { feederGame2Id: input.id },
              ],
            },
          });
          for (const next of nextGames) {
            if (next.feederGame1Id === input.id) {
              await tx.game.update({ where: { id: next.id }, data: { team1Id: newWinnerId } });
            }
            if (next.feederGame2Id === input.id) {
              await tx.game.update({ where: { id: next.id }, data: { team2Id: newWinnerId } });
            }
          }
        });
      } else {
        // No cascade needed -- simple update + advance (in transaction)
        await ctx.prisma.$transaction(async (tx) => {
          await tx.game.update({
            where: { id: input.id },
            data: {
              setScores: input.setScores,
              scoreTeam1: validation.setsWon.team1,
              scoreTeam2: validation.setsWon.team2,
              status: "COMPLETED",
            },
          });

          if (isBracket) {
            const nextGames = await tx.game.findMany({
              where: {
                OR: [
                  { feederGame1Id: input.id },
                  { feederGame2Id: input.id },
                ],
              },
            });

            for (const next of nextGames) {
              if (next.feederGame1Id === input.id) {
                await tx.game.update({
                  where: { id: next.id },
                  data: { team1Id: newWinnerId },
                });
              }
              if (next.feederGame2Id === input.id) {
                await tx.game.update({
                  where: { id: next.id },
                  data: { team2Id: newWinnerId },
                });
              }
            }
          }
        });
      }

      const updatedGame = await ctx.prisma.game.findUnique({
        where: { id: input.id },
        include: { round: true },
      });

      emitToTournament(input.tournamentId, "score:updated", {
        gameId: input.id,
        roundId: currentGame.roundId,
        poolId: currentGame.poolId,
        scoreTeam1: validation.setsWon.team1,
        scoreTeam2: validation.setsWon.team2,
        status: "COMPLETED",
      });

      return updatedGame;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        tournamentId: z.string(),
        status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "FORFEIT", "CANCELLED"]),
        forfeitWinnerId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const data: Record<string, unknown> = { status: input.status };

      if (input.status === "FORFEIT" && input.forfeitWinnerId) {
        const game = await ctx.prisma.game.findUnique({
          where: { id: input.id },
        });
        if (!game) throw new TRPCError({ code: "NOT_FOUND" });

        if (input.forfeitWinnerId === game.team1Id) {
          data.scoreTeam1 = 1;
          data.scoreTeam2 = 0;
        } else {
          data.scoreTeam1 = 0;
          data.scoreTeam2 = 1;
        }
      }

      const updated = await ctx.prisma.$transaction(async (tx) => {
        const result = await tx.game.update({
          where: { id: input.id },
          data,
          include: { round: true },
        });

        // Advance forfeit winner in bracket rounds
        if (
          input.status === "FORFEIT" &&
          input.forfeitWinnerId &&
          (result.round.type === "SINGLE_ELIM" || result.round.type === "DOUBLE_ELIM")
        ) {
          const nextGames = await tx.game.findMany({
            where: {
              OR: [
                { feederGame1Id: input.id },
                { feederGame2Id: input.id },
              ],
            },
          });
          for (const next of nextGames) {
            if (next.feederGame1Id === input.id) {
              await tx.game.update({
                where: { id: next.id },
                data: { team1Id: input.forfeitWinnerId },
              });
            }
            if (next.feederGame2Id === input.id) {
              await tx.game.update({
                where: { id: next.id },
                data: { team2Id: input.forfeitWinnerId },
              });
            }
          }
        }

        return result;
      });

      emitToTournament(input.tournamentId, "score:updated", {
        gameId: updated.id,
        roundId: updated.roundId,
        poolId: updated.poolId,
        scoreTeam1: updated.scoreTeam1,
        scoreTeam2: updated.scoreTeam2,
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

      const updated = await ctx.prisma.game.update({
        where: { id: input.id },
        data,
      });

      emitToTournament(input.tournamentId, "schedule:updated", {
        gameId: updated.id,
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
            gameId: z.string(),
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

          return ctx.prisma.game.update({
            where: { id: update.gameId },
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

      const game = await ctx.prisma.game.findUnique({
        where: { id: input.id },
        include: { round: true },
      });
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });

      const isBracket = game.round.type === "SINGLE_ELIM" || game.round.type === "DOUBLE_ELIM";

      if (isBracket) {
        const allGames = await ctx.prisma.game.findMany({
          where: { roundId: game.roundId },
          select: {
            id: true, team1Id: true, team2Id: true,
            status: true, scoreTeam1: true, scoreTeam2: true,
            feederGame1Id: true, feederGame2Id: true,
          },
        });

        const clearActions = getGamesToClear(input.id, allGames);
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
          // Reset the edited game
          await tx.game.update({
            where: { id: input.id },
            data: {
              scoreTeam1: null,
              scoreTeam2: null,
              setScores: Prisma.DbNull,
              status: "SCHEDULED",
            },
          });

          // Clear downstream team slots and scores
          for (const action of clearActions) {
            const clearData: Record<string, unknown> = {};
            if (action.clearTeam1) clearData.team1Id = null;
            if (action.clearTeam2) clearData.team2Id = null;
            if (action.clearScores) {
              clearData.scoreTeam1 = null;
              clearData.scoreTeam2 = null;
              clearData.setScores = Prisma.DbNull;
              clearData.status = "SCHEDULED";
            }
            await tx.game.update({ where: { id: action.gameId }, data: clearData });
          }
        });
      } else {
        await ctx.prisma.game.update({
          where: { id: input.id },
          data: {
            scoreTeam1: null,
            scoreTeam2: null,
            setScores: Prisma.DbNull,
            status: "SCHEDULED",
          },
        });
      }

      emitToTournament(input.tournamentId, "score:updated", {
        gameId: input.id,
        roundId: game.roundId,
        poolId: game.poolId,
        scoreTeam1: null,
        scoreTeam2: null,
        status: "SCHEDULED",
      });

      return ctx.prisma.game.findUnique({ where: { id: input.id } });
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

      // Fetch all games
      const allGames = await ctx.prisma.game.findMany({
        where: { round: { tournamentId: input.tournamentId } },
        select: {
          id: true, team1Id: true, team2Id: true,
          status: true, feederGame1Id: true, feederGame2Id: true,
        },
      });
      if (allGames.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No games to schedule. Generate games first.",
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
        allGames.map((g) => ({
          id: g.id,
          team1Id: g.team1Id,
          team2Id: g.team2Id,
          status: g.status,
          feederGame1Id: g.feederGame1Id,
          feederGame2Id: g.feederGame2Id,
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
          await tx.game.updateMany({
            where: { round: { tournamentId: input.tournamentId } },
            data: { scheduledAt: null, locationId: null },
          });
        }

        // Batch-update games with assignments sequentially to avoid pool exhaustion
        for (const a of result.assignments) {
          await tx.game.update({
            where: { id: a.gameId },
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
    .input(z.object({ roundId: z.string(), tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return fetchBracketData(ctx.prisma, input.roundId);
    }),

  getBracketDataPublic: baseProcedure
    .input(z.object({ roundId: z.string(), tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tournament = await ctx.prisma.tournament.findFirst({
        where: { id: input.tournamentId, deletedAt: null },
        select: { status: true },
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      if (tournament.status === "DRAFT") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tournament is not published" });
      }
      return fetchBracketData(ctx.prisma, input.roundId);
    }),

  getStandings: baseProcedure
    .input(
      z.object({
        roundId: z.string(),
        poolId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const round = await ctx.prisma.round.findFirst({
        where: { id: input.roundId, tournament: { deletedAt: null } },
        include: {
          tournament: {
            select: { pointsConfig: true, tiebreakerConfig: true },
          },
        },
      });
      if (!round) throw new TRPCError({ code: "NOT_FOUND" });

      const games = await ctx.prisma.game.findMany({
        where: {
          roundId: input.roundId,
          ...(input.poolId ? { poolId: input.poolId } : {}),
        },
        include: {
          team1: { select: { id: true, name: true } },
          team2: { select: { id: true, name: true } },
        },
      });

      const pointsConfig = round.tournament.pointsConfig as {
        win: number;
        draw: number;
        loss: number;
      };
      const tiebreakerConfig = round.tournament.tiebreakerConfig as {
        order: string[];
      };

      return calculateStandings(games, pointsConfig, tiebreakerConfig);
    }),
});
