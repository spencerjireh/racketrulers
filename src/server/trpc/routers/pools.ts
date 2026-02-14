import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, createTRPCRouter } from "../init";
import { verifyTournamentOwnership, verifyRoundOwnership } from "../helpers";

export const poolsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ roundId: z.string(), tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return ctx.prisma.pool.findMany({
        where: { roundId: input.roundId, round: { tournamentId: input.tournamentId } },
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
        tournamentId: z.string(),
        name: z.string().min(1, "Name is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { round } = await verifyRoundOwnership(
        ctx.prisma,
        input.roundId,
        input.tournamentId,
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
    .input(z.object({ id: z.string(), tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const pool = await ctx.prisma.pool.findFirst({
        where: { id: input.id, round: { tournamentId: input.tournamentId } },
      });
      if (!pool) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.pool.delete({ where: { id: input.id } });
    }),

  assignTeam: protectedProcedure
    .input(
      z.object({
        poolId: z.string(),
        tournamentId: z.string(),
        teamId: z.string(),
        seed: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      // Verify team belongs to the tournament
      const team = await ctx.prisma.team.findFirst({
        where: { id: input.teamId, tournamentId: input.tournamentId },
      });
      if (!team) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Team must belong to this tournament",
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
        tournamentId: z.string(),
        teamId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
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
        tournamentId: z.string(),
        poolCount: z.number().int().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyRoundOwnership(
        ctx.prisma,
        input.roundId,
        input.tournamentId,
        ctx.userId
      );

      // Get tournament teams ordered by seed
      const teams = await ctx.prisma.team.findMany({
        where: { tournamentId: input.tournamentId },
        orderBy: { seed: "asc" },
      });

      if (teams.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No teams in this tournament",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        // Delete existing pools for this round
        await tx.pool.deleteMany({ where: { roundId: input.roundId } });

        // Create pools
        const pools = [];
        for (let i = 0; i < input.poolCount; i++) {
          const pool = await tx.pool.create({
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

        for (let i = 0; i < teams.length; i++) {
          assignments.push({
            poolId: pools[poolIndex].id,
            teamId: teams[i].id,
            seed: Math.floor(i / input.poolCount) + 1,
          });

          poolIndex += direction;
          if (poolIndex >= input.poolCount || poolIndex < 0) {
            direction *= -1;
            poolIndex += direction;
          }
        }

        await tx.poolTeam.createMany({ data: assignments });

        return { poolsCreated: pools.length, teamsAssigned: assignments.length };
      });
    }),
});
