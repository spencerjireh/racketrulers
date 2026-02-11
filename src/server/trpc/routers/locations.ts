import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "../init";
import { verifyEventOwnership } from "../helpers";

export const locationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      return ctx.prisma.location.findMany({
        where: { eventId: input.eventId },
        orderBy: { createdAt: "asc" },
        include: {
          _count: { select: { games: true } },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        name: z.string().min(1, "Name is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      return ctx.prisma.location.create({
        data: {
          name: input.name,
          eventId: input.eventId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        eventId: z.string(),
        name: z.string().min(1, "Name is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      return ctx.prisma.location.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);
      return ctx.prisma.location.delete({
        where: { id: input.id },
      });
    }),
});
