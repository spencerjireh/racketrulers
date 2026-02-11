import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure, protectedProcedure, createTRPCRouter } from "../init";
import { generateUniqueSlug } from "@/lib/slug";
import { verifyEventOwnership } from "../helpers";

export const eventsRouter = createTRPCRouter({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [totalEvents, activeEvents] = await Promise.all([
      ctx.prisma.event.count({
        where: { ownerId: ctx.userId, deletedAt: null },
      }),
      ctx.prisma.event.count({
        where: {
          ownerId: ctx.userId,
          deletedAt: null,
          status: "PUBLISHED",
        },
      }),
    ]);
    return { totalEvents, activeEvents };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.event.findMany({
      where: { ownerId: ctx.userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            categories: true,
            teams: true,
            locations: true,
          },
        },
      },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        sport: z.string().min(1, "Sport is required"),
        startDate: z.string(),
        endDate: z.string(),
        timezone: z.string().default("America/Toronto"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      if (end < start) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End date must be on or after start date",
        });
      }

      const slug = await generateUniqueSlug(input.name, ctx.prisma);

      const event = await ctx.prisma.event.create({
        data: {
          name: input.name,
          slug,
          sport: input.sport,
          startDate: start,
          endDate: end,
          timezone: input.timezone,
          ownerId: ctx.userId,
        },
      });

      return event;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.prisma.event.findFirst({
        where: { id: input.id, ownerId: ctx.userId, deletedAt: null },
        include: { locations: true },
      });
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      return event;
    }),

  getBySlug: baseProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.prisma.event.findFirst({
        where: { slug: input.slug, deletedAt: null },
        include: {
          locations: true,
          categories: {
            orderBy: { order: "asc" },
            include: {
              categoryTeams: {
                include: { team: { select: { id: true, name: true } } },
                orderBy: { seed: "asc" },
              },
              rounds: {
                orderBy: { order: "asc" },
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
              },
            },
          },
        },
      });
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      return event;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        sport: z.string().min(1).optional(),
        description: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        timezone: z.string().optional(),
        pointsConfig: z
          .object({
            win: z.number(),
            draw: z.number(),
            loss: z.number(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const event = await verifyEventOwnership(
        ctx.prisma,
        input.id,
        ctx.userId
      );

      if (event.status === "COMPLETED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot update a completed event",
        });
      }

      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.sport !== undefined) updateData.sport = data.sport;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.timezone !== undefined) updateData.timezone = data.timezone;
      if (data.pointsConfig !== undefined)
        updateData.pointsConfig = data.pointsConfig;
      if (data.startDate !== undefined)
        updateData.startDate = new Date(data.startDate);
      if (data.endDate !== undefined)
        updateData.endDate = new Date(data.endDate);

      return ctx.prisma.event.update({
        where: { id },
        data: updateData,
      });
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.id, ctx.userId);
      return ctx.prisma.event.update({
        where: { id: input.id },
        data: { status: "COMPLETED" },
      });
    }),

  reopen: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.id, ctx.userId);
      return ctx.prisma.event.update({
        where: { id: input.id },
        data: { status: "PUBLISHED" },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyEventOwnership(ctx.prisma, input.id, ctx.userId);
      return ctx.prisma.event.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),
});
