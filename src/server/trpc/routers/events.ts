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
          startDate: start,
          endDate: end,
          timezone: input.timezone,
          ownerId: ctx.userId,
          status: "DRAFT",
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
        where: { slug: input.slug, deletedAt: null, status: { not: "DRAFT" } },
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
        scoringConfig: z
          .object({
            pointsPerSet: z.number().int().min(1).max(50),
            totalSets: z.number().int().refine((v) => v >= 1 && v <= 9 && v % 2 === 1, {
              message: "Total sets must be an odd number between 1 and 9",
            }),
            deuceEnabled: z.boolean(),
            maxPoints: z.number().int().min(1).max(50),
          })
          .optional(),
        scheduleConfig: z
          .object({
            slotDuration: z.number().int().min(5).max(120),
            dayStartHour: z.number().int().min(0).max(23),
            dayEndHour: z.number().int().min(1).max(24),
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
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.timezone !== undefined) updateData.timezone = data.timezone;
      if (data.pointsConfig !== undefined)
        updateData.pointsConfig = data.pointsConfig;
      if (data.scoringConfig !== undefined)
        updateData.scoringConfig = data.scoringConfig;
      if (data.scheduleConfig !== undefined)
        updateData.scheduleConfig = data.scheduleConfig;
      if (data.startDate !== undefined)
        updateData.startDate = new Date(data.startDate);
      if (data.endDate !== undefined)
        updateData.endDate = new Date(data.endDate);

      return ctx.prisma.event.update({
        where: { id },
        data: updateData,
      });
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const event = await verifyEventOwnership(ctx.prisma, input.id, ctx.userId);

      if (event.status !== "DRAFT") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only draft events can be published",
        });
      }

      // Validate event has minimum required setup
      const [categoryCount, teamCount, gameCount] = await Promise.all([
        ctx.prisma.category.count({ where: { eventId: input.id } }),
        ctx.prisma.team.count({ where: { eventId: input.id } }),
        ctx.prisma.game.count({
          where: { round: { category: { eventId: input.id } } },
        }),
      ]);

      if (categoryCount === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Event must have at least 1 category",
        });
      }
      if (teamCount < 2) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Event must have at least 2 teams",
        });
      }
      if (gameCount === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Games must be generated before publishing",
        });
      }

      return ctx.prisma.event.update({
        where: { id: input.id },
        data: { status: "PUBLISHED" },
      });
    }),

  applyTemplate: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        template: z.enum(["round_robin", "rr_playoffs", "single_elim", "double_elim"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const event = await verifyEventOwnership(ctx.prisma, input.eventId, ctx.userId);

      if (event.status === "COMPLETED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot modify a completed event",
        });
      }

      // Delete existing categories (cascade deletes rounds/games)
      await ctx.prisma.category.deleteMany({ where: { eventId: input.eventId } });

      const templateConfigs = {
        round_robin: {
          categoryName: "Main",
          rounds: [{ name: "Round Robin", type: "ROUND_ROBIN" as const, order: 0 }],
        },
        rr_playoffs: {
          categoryName: "Main",
          rounds: [
            { name: "Group Stage", type: "ROUND_ROBIN" as const, order: 0 },
            { name: "Playoffs", type: "SINGLE_ELIM" as const, order: 1 },
          ],
        },
        single_elim: {
          categoryName: "Main",
          rounds: [{ name: "Bracket", type: "SINGLE_ELIM" as const, order: 0 }],
        },
        double_elim: {
          categoryName: "Main",
          rounds: [{ name: "Bracket", type: "DOUBLE_ELIM" as const, order: 0 }],
        },
      };

      const config = templateConfigs[input.template];

      const category = await ctx.prisma.category.create({
        data: {
          name: config.categoryName,
          eventId: input.eventId,
          order: 0,
        },
      });

      for (const round of config.rounds) {
        await ctx.prisma.round.create({
          data: {
            name: round.name,
            type: round.type,
            order: round.order,
            categoryId: category.id,
          },
        });
      }

      return { categoryId: category.id, template: input.template };
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

  listPublic: baseProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z
          .enum(["all", "upcoming", "in-progress", "completed"])
          .optional()
          .default("all"),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(50).optional().default(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const where: Record<string, unknown> = {
        deletedAt: null,
        status: { not: "DRAFT" },
      };

      if (input.search) {
        where.name = { contains: input.search, mode: "insensitive" };
      }

      if (input.status === "upcoming") {
        where.status = "PUBLISHED";
        where.startDate = { gt: now };
      } else if (input.status === "in-progress") {
        where.status = "PUBLISHED";
        where.startDate = { lte: now };
        where.endDate = { gte: now };
      } else if (input.status === "completed") {
        where.status = "COMPLETED";
      }

      const [events, totalCount] = await Promise.all([
        ctx.prisma.event.findMany({
          where,
          orderBy: { startDate: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            bannerUrl: true,
            status: true,
            startDate: true,
            endDate: true,
            _count: {
              select: {
                categories: true,
                teams: true,
                locations: true,
              },
            },
          },
        }),
        ctx.prisma.event.count({ where }),
      ]);

      return {
        events,
        totalCount,
        totalPages: Math.ceil(totalCount / input.pageSize),
        currentPage: input.page,
      };
    }),
});
