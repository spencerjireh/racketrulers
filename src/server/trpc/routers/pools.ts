import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, createTRPCRouter } from "../init";
import { verifyEventOwnership, verifyRoundOwnership } from "../helpers";

export const poolsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ roundId: z.string(), eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      return ctx.prisma.pool.findMany({
        where: { roundId: input.roundId, round: { category: { eventId: input.eventId } } },
        orderBy: { createdAt: "asc" },
        include: {
          poolTeams: {
            include: { team: { select: { id: true, name: true } } },
            orderBy: { seed: "asc" },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        roundId: z.string(),
        eventId: z.string(),
        name: z.string().min(1, "Name is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { round } = await verifyRoundOwnership(
        ctx.prisma,
        input.roundId,
        input.eventId,
        ctx.userId
      );
      if (round.type !== "ROUND_ROBIN") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pools are only used for round robin rounds",
        });
      }

      return ctx.prisma.pool.create({
        data: { name: input.name, roundId: input.roundId },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      return ctx.prisma.pool.delete({ where: { id: input.id } });
    }),

  assignTeam: protectedProcedure
    .input(
      z.object({
        poolId: z.string(),
        eventId: z.string(),
        teamId: z.string(),
        seed: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      // Verify team belongs to the category
      const pool = await ctx.prisma.pool.findUnique({
        where: { id: input.poolId },
        include: { round: { include: { category: true } } },
      });
      if (!pool) throw new TRPCError({ code: "NOT_FOUND" });

      const inCategory = await ctx.prisma.categoryTeam.findFirst({
        where: {
          categoryId: pool.round.categoryId,
          teamId: input.teamId,
        },
      });
      if (!inCategory) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Team must be assigned to the category first",
        });
      }

      return ctx.prisma.poolTeam.create({
        data: {
          poolId: input.poolId,
          teamId: input.teamId,
          seed: input.seed ?? 0,
        },
      });
    }),

  removeTeam: protectedProcedure
    .input(
      z.object({
        poolId: z.string(),
        eventId: z.string(),
        teamId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      return ctx.prisma.poolTeam.delete({
        where: {
          poolId_teamId: {
            poolId: input.poolId,
            teamId: input.teamId,
          },
        },
      });
    }),

  autoAssign: protectedProcedure
    .input(
      z.object({
        roundId: z.string(),
        eventId: z.string(),
        poolCount: z.number().int().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { round } = await verifyRoundOwnership(
        ctx.prisma,
        input.roundId,
        input.eventId,
        ctx.userId
      );

      // Get category teams ordered by seed
      const categoryTeams = await ctx.prisma.categoryTeam.findMany({
        where: { categoryId: round.categoryId },
        orderBy: { seed: "asc" },
      });

      if (categoryTeams.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No teams assigned to this category",
        });
      }

      // Delete existing pools for this round
      await ctx.prisma.pool.deleteMany({ where: { roundId: input.roundId } });

      // Create pools
      const pools = [];
      for (let i = 0; i < input.poolCount; i++) {
        const pool = await ctx.prisma.pool.create({
          data: {
            name: `Pool ${String.fromCharCode(65 + i)}`,
            roundId: input.roundId,
          },
        });
        pools.push(pool);
      }

      // Snake draft assignment
      const assignments: { poolId: string; teamId: string; seed: number }[] = [];
      let poolIndex = 0;
      let direction = 1;

      for (let i = 0; i < categoryTeams.length; i++) {
        assignments.push({
          poolId: pools[poolIndex].id,
          teamId: categoryTeams[i].teamId,
          seed: Math.floor(i / input.poolCount) + 1,
        });

        poolIndex += direction;
        if (poolIndex >= input.poolCount || poolIndex < 0) {
          direction *= -1;
          poolIndex += direction;
        }
      }

      await ctx.prisma.poolTeam.createMany({ data: assignments });

      return { poolsCreated: pools.length, teamsAssigned: assignments.length };
    }),
});
