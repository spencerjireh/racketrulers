import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, createTRPCRouter } from "../init";
import { verifyTournamentOwnership } from "../helpers";

export const locationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return ctx.prisma.location.findMany({
        where: { tournamentId: input.tournamentId },
        orderBy: { createdAt: "asc" },
        include: {
          _count: { select: { games: true } },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        name: z.string().min(1, "Name is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return ctx.prisma.location.create({
        data: {
          name: input.name,
          tournamentId: input.tournamentId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        tournamentId: z.string(),
        name: z.string().min(1, "Name is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return ctx.prisma.location.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const location = await ctx.prisma.location.findFirst({
        where: { id: input.id, tournamentId: input.tournamentId },
      });
      if (!location) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.location.delete({
        where: { id: input.id },
      });
    }),
});
