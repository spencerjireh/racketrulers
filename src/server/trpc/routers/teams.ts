import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, createTRPCRouter } from "../init";
import { verifyEventOwnership } from "../helpers";

export const teamsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      return ctx.prisma.team.findMany({
        where: { eventId: input.eventId },
        orderBy: { createdAt: "asc" },
        include: {
          _count: {
            select: { categoryTeams: true, gamesAsTeam1: true, gamesAsTeam2: true },
          },
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      const team = await ctx.prisma.team.findFirst({
        where: { id: input.id, eventId: input.eventId },
        include: { categoryTeams: { include: { category: true } } },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      return team;
    }),

  create: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        name: z.string().min(1, "Name is required"),
        captainName: z.string().optional(),
        captainEmail: z.string().email().optional().or(z.literal("")),
        roster: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const existing = await ctx.prisma.team.findFirst({
        where: { eventId: input.eventId, name: input.name },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A team with this name already exists in this event",
        });
      }

      return ctx.prisma.team.create({
        data: {
          name: input.name,
          captainName: input.captainName || null,
          captainEmail: input.captainEmail || null,
          roster: input.roster || [],
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
        captainName: z.string().optional(),
        captainEmail: z.string().email().optional().or(z.literal("")),
        roster: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      if (input.name) {
        const existing = await ctx.prisma.team.findFirst({
          where: {
            eventId: input.eventId,
            name: input.name,
            NOT: { id: input.id },
          },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A team with this name already exists in this event",
          });
        }
      }

      const { id, eventId, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.captainName !== undefined) updateData.captainName = data.captainName || null;
      if (data.captainEmail !== undefined) updateData.captainEmail = data.captainEmail || null;
      if (data.roster !== undefined) updateData.roster = data.roster;

      return ctx.prisma.team.update({
        where: { id },
        data: updateData,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

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

      return ctx.prisma.team.delete({ where: { id: input.id } });
    }),

  bulkCreate: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
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
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      const existing = await ctx.prisma.team.findMany({
        where: { eventId: input.eventId },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));

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
        data: newTeams.map((t) => ({
          name: t.name,
          captainName: t.captainName || null,
          captainEmail: t.captainEmail || null,
          roster: [],
          eventId: input.eventId,
        })),
      });

      return { created: newTeams.length, skipped: input.teams.length - newTeams.length };
    }),
});
