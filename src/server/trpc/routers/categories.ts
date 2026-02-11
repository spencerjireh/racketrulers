import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, createTRPCRouter } from "../init";
import { verifyEventOwnership } from "../helpers";

export const categoriesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      return ctx.prisma.category.findMany({
        where: { eventId: input.eventId },
        orderBy: { order: "asc" },
        include: {
          _count: { select: { categoryTeams: true, rounds: true } },
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.id, eventId: input.eventId },
        include: {
          categoryTeams: {
            include: { team: { select: { id: true, name: true } } },
            orderBy: { seed: "asc" },
          },
        },
      });
      if (!category) throw new TRPCError({ code: "NOT_FOUND" });
      return category;
    }),

  create: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        name: z.string().min(1, "Name is required"),
        drawsAllowed: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const maxOrder = await ctx.prisma.category.aggregate({
        where: { eventId: input.eventId },
        _max: { order: true },
      });

      return ctx.prisma.category.create({
        data: {
          name: input.name,
          drawsAllowed: input.drawsAllowed ?? false,
          order: (maxOrder._max.order ?? -1) + 1,
          eventId: input.eventId,
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
        tiebreakerConfig: z
          .object({ order: z.array(z.string()) })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const { id, eventId, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.drawsAllowed !== undefined) updateData.drawsAllowed = data.drawsAllowed;
      if (data.tiebreakerConfig !== undefined) updateData.tiebreakerConfig = data.tiebreakerConfig;

      return ctx.prisma.category.update({ where: { id }, data: updateData });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const inProgress = await ctx.prisma.game.count({
        where: {
          round: { categoryId: input.id },
          status: "IN_PROGRESS",
        },
      });
      if (inProgress > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot delete category with in-progress games",
        });
      }

      return ctx.prisma.category.delete({ where: { id: input.id } });
    }),

  reorder: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        orderedIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      await ctx.prisma.$transaction(
        input.orderedIds.map((id, index) =>
          ctx.prisma.category.update({
            where: { id },
            data: { order: index },
          })
        )
      );
    }),

  assignTeam: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        eventId: z.string(),
        teamId: z.string(),
        seed: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      return ctx.prisma.categoryTeam.create({
        data: {
          categoryId: input.categoryId,
          teamId: input.teamId,
          seed: input.seed ?? 0,
        },
      });
    }),

  removeTeam: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        eventId: z.string(),
        teamId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const games = await ctx.prisma.game.count({
        where: {
          round: { categoryId: input.categoryId },
          OR: [{ team1Id: input.teamId }, { team2Id: input.teamId }],
        },
      });
      if (games > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot remove team that has games in this category",
        });
      }

      return ctx.prisma.categoryTeam.delete({
        where: {
          categoryId_teamId: {
            categoryId: input.categoryId,
            teamId: input.teamId,
          },
        },
      });
    }),

  updateSeed: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        eventId: z.string(),
        teamId: z.string(),
        seed: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      return ctx.prisma.categoryTeam.update({
        where: {
          categoryId_teamId: {
            categoryId: input.categoryId,
            teamId: input.teamId,
          },
        },
        data: { seed: input.seed },
      });
    }),

  randomizeSeeds: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        eventId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const teams = await ctx.prisma.categoryTeam.findMany({
        where: { categoryId: input.categoryId },
      });

      const shuffled = [...teams].sort(() => Math.random() - 0.5);

      await ctx.prisma.$transaction(
        shuffled.map((ct, index) =>
          ctx.prisma.categoryTeam.update({
            where: { id: ct.id },
            data: { seed: index + 1 },
          })
        )
      );
    }),
});
