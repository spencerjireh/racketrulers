import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { protectedProcedure, createTRPCRouter } from "../init";
import { verifyEventOwnership, verifyCategoryOwnership } from "../helpers";
import {
  generateRoundRobinGames,
  generateSingleElimGames,
} from "@/server/lib/game-generation";

export const roundsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ categoryId: z.string(), eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      return ctx.prisma.round.findMany({
        where: { categoryId: input.categoryId, category: { eventId: input.eventId } },
        orderBy: { order: "asc" },
        include: {
          _count: { select: { pools: true, games: true } },
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      const round = await ctx.prisma.round.findFirst({
        where: { id: input.id, category: { eventId: input.eventId } },
        include: {
          pools: {
            include: {
              poolTeams: {
                include: { team: { select: { id: true, name: true } } },
                orderBy: { seed: "asc" },
              },
            },
          },
          _count: { select: { games: true } },
        },
      });
      if (!round) throw new TRPCError({ code: "NOT_FOUND" });
      return round;
    }),

  create: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        eventId: z.string(),
        name: z.string().min(1, "Name is required"),
        type: z.enum(["ROUND_ROBIN", "SINGLE_ELIM"]),
        drawsAllowed: z.boolean().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyCategoryOwnership(
        ctx.prisma,
        input.categoryId,
        input.eventId,
        ctx.userId
      );

      const maxOrder = await ctx.prisma.round.aggregate({
        where: { categoryId: input.categoryId },
        _max: { order: true },
      });

      return ctx.prisma.round.create({
        data: {
          name: input.name,
          type: input.type,
          drawsAllowed: input.drawsAllowed ?? false,
          config: (input.config as Prisma.InputJsonValue) ?? undefined,
          order: (maxOrder._max.order ?? -1) + 1,
          categoryId: input.categoryId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        eventId: z.string(),
        name: z.string().min(1).optional(),
        drawsAllowed: z.boolean().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const { id, eventId, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.drawsAllowed !== undefined) updateData.drawsAllowed = data.drawsAllowed;
      if (data.config !== undefined) updateData.config = data.config;

      return ctx.prisma.round.update({ where: { id }, data: updateData });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const inProgress = await ctx.prisma.game.count({
        where: { roundId: input.id, status: "IN_PROGRESS" },
      });
      if (inProgress > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot delete round with in-progress games",
        });
      }

      return ctx.prisma.round.delete({ where: { id: input.id } });
    }),

  generateGames: protectedProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const round = await ctx.prisma.round.findFirst({
        where: { id: input.id, category: { eventId: input.eventId } },
        include: {
          pools: {
            include: {
              poolTeams: { orderBy: { seed: "asc" }, include: { team: true } },
            },
          },
          category: {
            include: {
              categoryTeams: { orderBy: { seed: "asc" } },
            },
          },
        },
      });
      if (!round) throw new TRPCError({ code: "NOT_FOUND" });

      const existingGames = await ctx.prisma.game.count({
        where: { roundId: input.id },
      });
      if (existingGames > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Games already exist. Clear them first before regenerating.",
        });
      }

      if (round.type === "ROUND_ROBIN") {
        if (round.pools.length === 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Create pools and assign teams before generating games",
          });
        }

        const allGames: {
          team1Id: string | null;
          team2Id: string | null;
          roundPosition: number;
          poolId: string | null;
          roundId: string;
          status: "SCHEDULED";
        }[] = [];

        let globalPosition = 1;
        for (const pool of round.pools) {
          const teamIds = pool.poolTeams.map((pt) => pt.teamId);
          if (teamIds.length < 2) continue;

          const games = generateRoundRobinGames(pool.id, teamIds);
          for (const g of games) {
            allGames.push({
              ...g,
              roundPosition: globalPosition++,
              roundId: round.id,
              status: "SCHEDULED",
            });
          }
        }

        await ctx.prisma.game.createMany({ data: allGames });
        return { gamesCreated: allGames.length };
      }

      if (round.type === "SINGLE_ELIM") {
        const teamIds = round.category.categoryTeams.map((ct) => ct.teamId);
        if (teamIds.length < 2) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Need at least 2 teams for single elimination",
          });
        }

        const consolation =
          (round.config as Record<string, unknown>)?.consolation_match === true;
        const games = generateSingleElimGames(teamIds, consolation);

        // Create games sequentially to get IDs for feeder linking
        const createdIds: string[] = [];
        for (const g of games) {
          const created = await ctx.prisma.game.create({
            data: {
              team1Id: g.team1Id,
              team2Id: g.team2Id,
              roundPosition: g.roundPosition,
              roundId: round.id,
              status: "SCHEDULED",
            },
          });
          createdIds.push(created.id);
        }

        return { gamesCreated: createdIds.length };
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unsupported round type: ${round.type}`,
      });
    }),

  clearGames: protectedProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const blocked = await ctx.prisma.game.count({
        where: {
          roundId: input.id,
          status: { in: ["IN_PROGRESS", "COMPLETED"] },
        },
      });
      if (blocked > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot clear games that are in progress or completed",
        });
      }

      await ctx.prisma.game.deleteMany({ where: { roundId: input.id } });
    }),
});
