import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  baseProcedure,
  protectedProcedure,
  createTRPCRouter,
} from "../init";
import { verifyEventOwnership } from "../helpers";
import { calculateStandings } from "@/server/lib/standings";
import { emitToEvent } from "@/lib/socket";

export const gamesRouter = createTRPCRouter({
  listByRound: protectedProcedure
    .input(z.object({ roundId: z.string(), eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
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

  listByEvent: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "FORFEIT", "CANCELLED"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      return ctx.prisma.game.findMany({
        where: {
          round: { category: { eventId: input.eventId } },
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
              category: { select: { id: true, name: true } },
            },
          },
        },
      });
    }),

  listByEventPublic: baseProcedure
    .input(
      z.object({
        eventId: z.string(),
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
            category: { eventId: input.eventId },
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
              category: { select: { id: true, name: true } },
            },
          },
        },
      });
    }),

  updateScore: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        eventId: z.string(),
        scoreTeam1: z.number().int().min(0),
        scoreTeam2: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const game = await ctx.prisma.game.update({
        where: { id: input.id },
        data: {
          scoreTeam1: input.scoreTeam1,
          scoreTeam2: input.scoreTeam2,
          status: "COMPLETED",
        },
        include: { round: true },
      });

      // For single elim: advance winner to next bracket game
      if (game.round.type === "SINGLE_ELIM") {
        const winnerId =
          input.scoreTeam1 > input.scoreTeam2 ? game.team1Id : game.team2Id;

        // Find games that reference this game as a feeder
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

      emitToEvent(input.eventId, "score:updated", {
        gameId: game.id,
        roundId: game.roundId,
        poolId: game.poolId,
        scoreTeam1: input.scoreTeam1,
        scoreTeam2: input.scoreTeam2,
        status: "COMPLETED",
      }).catch(() => {});

      return game;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        eventId: z.string(),
        status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "FORFEIT", "CANCELLED"]),
        forfeitWinnerId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

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

      emitToEvent(input.eventId, "score:updated", {
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
        eventId: z.string(),
        scheduledAt: z.string().optional(),
        locationId: z.string().nullable().optional(),
        durationMinutes: z.number().int().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const data: Record<string, unknown> = {};
      if (input.scheduledAt !== undefined)
        data.scheduledAt = new Date(input.scheduledAt);
      if (input.locationId !== undefined)
        data.locationId = input.locationId;
      if (input.durationMinutes !== undefined)
        data.durationMinutes = input.durationMinutes;

      const updated = await ctx.prisma.game.update({
        where: { id: input.id },
        data,
      });

      emitToEvent(input.eventId, "schedule:updated", {
        gameId: updated.id,
        scheduledAt: updated.scheduledAt,
        locationId: updated.locationId,
      }).catch(() => {});

      return updated;
    }),

  resetScore: protectedProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      return ctx.prisma.game.update({
        where: { id: input.id },
        data: {
          scoreTeam1: null,
          scoreTeam2: null,
          status: "SCHEDULED",
        },
      });
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
          category: {
            include: { event: { select: { pointsConfig: true } } },
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

      const pointsConfig = round.category.event.pointsConfig as {
        win: number;
        draw: number;
        loss: number;
      };
      const tiebreakerConfig = round.category.tiebreakerConfig as {
        order: string[];
      };

      return calculateStandings(games, pointsConfig, tiebreakerConfig);
    }),
});
