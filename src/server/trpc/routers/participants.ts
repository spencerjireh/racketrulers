import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure, protectedProcedure, createTRPCRouter } from "../init";
import { verifyTournamentOwnership } from "../helpers";
import { fisherYatesShuffle, stripUndefined } from "@/lib/utils";

export const participantsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return ctx.prisma.participant.findMany({
        where: { tournamentId: input.tournamentId },
        orderBy: { seed: "asc" },
        include: {
          _count: {
            select: { matchesAsParticipant1: true, matchesAsParticipant2: true },
          },
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string(), tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      const participant = await ctx.prisma.participant.findFirst({
        where: { id: input.id, tournamentId: input.tournamentId },
      });
      if (!participant) throw new TRPCError({ code: "NOT_FOUND" });
      return participant;
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

      const existing = await ctx.prisma.participant.findFirst({
        where: { tournamentId: input.tournamentId, name: input.name },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A participant with this name already exists in this tournament",
        });
      }

      // Auto-assign next seed
      const maxSeed = await ctx.prisma.participant.aggregate({
        where: { tournamentId: input.tournamentId },
        _max: { seed: true },
      });

      return ctx.prisma.participant.create({
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
        const existing = await ctx.prisma.participant.findFirst({
          where: {
            tournamentId: input.tournamentId,
            name: input.name,
            NOT: { id: input.id },
          },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A participant with this name already exists in this tournament",
          });
        }
      }

      const updateData = stripUndefined({
        name: input.name,
        captainName: input.captainName !== undefined ? (input.captainName || null) : undefined,
        captainEmail: input.captainEmail !== undefined ? (input.captainEmail || null) : undefined,
        roster: input.roster,
      });

      return ctx.prisma.participant.update({
        where: { id: input.id },
        data: updateData,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const activeMatches = await ctx.prisma.match.count({
        where: {
          OR: [{ participant1Id: input.id }, { participant2Id: input.id }],
          status: { in: ["PENDING", "OPEN"] },
        },
      });
      if (activeMatches > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot delete participant with active matches",
        });
      }

      const participant = await ctx.prisma.participant.findFirst({
        where: { id: input.id, tournamentId: input.tournamentId },
      });
      if (!participant) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.participant.delete({ where: { id: input.id } });
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

      const existing = await ctx.prisma.participant.findMany({
        where: { tournamentId: input.tournamentId },
        select: { name: true, seed: true },
      });
      const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));
      const maxSeed = Math.max(0, ...existing.map((t) => t.seed));

      const newParticipants = input.teams.filter(
        (t) => !existingNames.has(t.name.toLowerCase())
      );

      if (newParticipants.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "All participant names already exist",
        });
      }

      await ctx.prisma.participant.createMany({
        data: newParticipants.map((t, i) => ({
          name: t.name,
          captainName: t.captainName || null,
          captainEmail: t.captainEmail || null,
          roster: [],
          seed: maxSeed + i + 1,
          tournamentId: input.tournamentId,
        })),
      });

      return { created: newParticipants.length, skipped: input.teams.length - newParticipants.length };
    }),

  updateSeed: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        participantId: z.string(),
        seed: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      return ctx.prisma.participant.update({
        where: { id: input.participantId },
        data: { seed: input.seed },
      });
    }),

  randomizeSeeds: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tournament = await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      if (tournament.status !== "PENDING") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Seeds can only be randomized before the tournament starts",
        });
      }

      const participants = await ctx.prisma.participant.findMany({
        where: { tournamentId: input.tournamentId },
      });

      const shuffled = fisherYatesShuffle([...participants]);

      await ctx.prisma.$transaction(
        shuffled.map((p, index) =>
          ctx.prisma.participant.update({
            where: { id: p.id },
            data: { seed: index + 1 },
          })
        )
      );

      return { randomized: shuffled.length };
    }),

  reorderSeeds: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        participantIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tournament = await verifyTournamentOwnership(
        ctx.prisma,
        input.tournamentId,
        ctx.userId
      );

      if (tournament.status !== "PENDING") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Seeds can only be reordered before the tournament starts",
        });
      }

      await ctx.prisma.$transaction(
        input.participantIds.map((id, index) =>
          ctx.prisma.participant.update({
            where: { id, tournamentId: input.tournamentId },
            data: { seed: index + 1 },
          })
        )
      );

      return { reordered: input.participantIds.length };
    }),

  listPublic: baseProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tournament = await ctx.prisma.tournament.findFirst({
        where: {
          id: input.tournamentId,
          deletedAt: null,
          OR: [
            { status: { not: "PENDING" } },
            ...(ctx.userId ? [{ ownerId: ctx.userId }] : []),
          ],
        },
        select: { id: true },
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.participant.findMany({
        where: { tournamentId: input.tournamentId },
        orderBy: { seed: "asc" },
        select: { id: true, name: true, seed: true },
      });
    }),
});
