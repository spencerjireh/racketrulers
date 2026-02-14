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

      const game = await ctx.prisma.game.update({
        where: { id: input.id },
        data: {
          setScores: input.setScores,
          scoreTeam1: validation.setsWon.team1,
          scoreTeam2: validation.setsWon.team2,
          status: "COMPLETED",
        },
        include: { round: true },
      });

      // For single elim: advance winner to next bracket game
      if (game.round.type === "SINGLE_ELIM") {
        const winnerId =
          validation.setsWon.team1 > validation.setsWon.team2
            ? game.team1Id
            : game.team2Id;

        const nextGames = await ctx.prisma.game.findMany({
          where: {
            OR: [
              { feederGame1Id: game.id },
              { feederGame2Id: game.id },
            ],
          },
        });

        for (const next of nextGames) {
          if (next.feederGame1Id === game.id) {
            await ctx.prisma.game.update({
              where: { id: next.id },
              data: { team1Id: winnerId },
            });
          }
          if (next.feederGame2Id === game.id) {
            await ctx.prisma.game.update({
              where: { id: next.id },
              data: { team2Id: winnerId },
            });
          }
        }
      }

      emitToTournament(input.tournamentId, "score:updated", {
        gameId: game.id,
        roundId: game.roundId,
        poolId: game.poolId,
        scoreTeam1: validation.setsWon.team1,
        scoreTeam2: validation.setsWon.team2,
        status: "COMPLETED",
      }).catch(() => {});

      return game;
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

      const updated = await ctx.prisma.game.update({
        where: { id: input.id },
        data,
      });

      emitToTournament(input.tournamentId, "score:updated", {
        gameId: updated.id,
        roundId: updated.roundId,
        poolId: updated.poolId,
        scoreTeam1: updated.scoreTeam1,
        scoreTeam2: updated.scoreTeam2,
        status: updated.status,
      }).catch(() => {});

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

      const data: Record<string, unknown> = {};
      if (input.scheduledAt !== undefined)
        data.scheduledAt = new Date(input.scheduledAt);
      if (input.locationId !== undefined)
        data.locationId = input.locationId;
      if (input.durationMinutes !== undefined)
        data.durationMinutes = input.durationMinutes;
      if (input.matchType !== undefined)
        data.matchType = input.matchType;

      const updated = await ctx.prisma.game.update({
        where: { id: input.id },
        data,
      });

      emitToTournament(input.tournamentId, "schedule:updated", {
        gameId: updated.id,
        scheduledAt: updated.scheduledAt,
        locationId: updated.locationId,
      }).catch(() => {});

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

      const results = await Promise.all(
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
      }).catch(() => {});

      return { updated: results.length };
    }),

  resetScore: protectedProcedure
    .input(z.object({ id: z.string(), tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      return ctx.prisma.game.update({
        where: { id: input.id },
        data: {
          scoreTeam1: null,
          scoreTeam2: null,
          setScores: Prisma.DbNull,
          status: "SCHEDULED",
        },
      });
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
      const round = await ctx.prisma.round.findUnique({
        where: { id: input.roundId },
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
