import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, createTRPCRouter } from "../init";
import { verifyTournamentOwnership } from "../helpers";
import { fisherYatesShuffle, stripUndefined } from "@/lib/utils";

export const teamsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return ctx.prisma.team.findMany({
        where: { tournamentId: input.tournamentId },
        orderBy: { seed: "asc" },
        include: {
          _count: {
            select: { gamesAsTeam1: true, gamesAsTeam2: true },
          },
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string(), tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      const team = await ctx.prisma.team.findFirst({
        where: { id: input.id, tournamentId: input.tournamentId },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      return team;
    }),

  create: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        name: z.string().min(1, "Name is required"),
        captainName: z.string().optional(),
        captainEmail: z.string().email().optional().or(z.literal("")),
        roster: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const existing = await ctx.prisma.team.findFirst({
        where: { tournamentId: input.tournamentId, name: input.name },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A team with this name already exists in this tournament",
        });
      }

      // Auto-assign next seed
      const maxSeed = await ctx.prisma.team.aggregate({
        where: { tournamentId: input.tournamentId },
        _max: { seed: true },
      });

      return ctx.prisma.team.create({
        data: {
          name: input.name,
          captainName: input.captainName || null,
          captainEmail: input.captainEmail || null,
          roster: input.roster || [],
          seed: (maxSeed._max.seed ?? 0) + 1,
          tournamentId: input.tournamentId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        tournamentId: z.string(),
        name: z.string().min(1).optional(),
        captainName: z.string().optional(),
        captainEmail: z.string().email().optional().or(z.literal("")),
        roster: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      if (input.name) {
        const existing = await ctx.prisma.team.findFirst({
          where: {
            tournamentId: input.tournamentId,
            name: input.name,
            NOT: { id: input.id },
          },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A team with this name already exists in this tournament",
          });
        }
      }

      const updateData = stripUndefined({
        name: input.name,
        captainName: input.captainName !== undefined ? (input.captainName || null) : undefined,
        captainEmail: input.captainEmail !== undefined ? (input.captainEmail || null) : undefined,
        roster: input.roster,
      });

      return ctx.prisma.team.update({
        where: { id: input.id },
        data: updateData,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const activeGames = await ctx.prisma.game.count({
        where: {
          OR: [{ team1Id: input.id }, { team2Id: input.id }],
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
      });
      if (activeGames > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot delete team with active games",
        });
      }

      const team = await ctx.prisma.team.findFirst({
        where: { id: input.id, tournamentId: input.tournamentId },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.team.delete({ where: { id: input.id } });
    }),

  bulkCreate: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        teams: z.array(
          z.object({
            name: z.string().min(1),
            captainName: z.string().optional(),
            captainEmail: z.string().email().optional().or(z.literal("")),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const existing = await ctx.prisma.team.findMany({
        where: { tournamentId: input.tournamentId },
        select: { name: true, seed: true },
      });
      const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));
      const maxSeed = Math.max(0, ...existing.map((t) => t.seed));

      const newTeams = input.teams.filter(
        (t) => !existingNames.has(t.name.toLowerCase())
      );

      if (newTeams.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "All team names already exist",
        });
      }

      await ctx.prisma.team.createMany({
        data: newTeams.map((t, i) => ({
          name: t.name,
          captainName: t.captainName || null,
          captainEmail: t.captainEmail || null,
          roster: [],
          seed: maxSeed + i + 1,
          tournamentId: input.tournamentId,
        })),
      });

      return { created: newTeams.length, skipped: input.teams.length - newTeams.length };
    }),

  updateSeed: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        teamId: z.string(),
        seed: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      return ctx.prisma.team.update({
        where: { id: input.teamId },
        data: { seed: input.seed },
      });
    }),

  randomizeSeeds: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const teams = await ctx.prisma.team.findMany({
        where: { tournamentId: input.tournamentId },
      });

      const shuffled = fisherYatesShuffle([...teams]);

      await ctx.prisma.$transaction(
        shuffled.map((t, index) =>
          ctx.prisma.team.update({
            where: { id: t.id },
            data: { seed: index + 1 },
          })
        )
      );
    }),
});
