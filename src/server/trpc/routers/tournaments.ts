import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure, protectedProcedure, createTRPCRouter } from "../init";
import { generateUniqueSlug } from "@/lib/slug";
import { verifyTournamentOwnership } from "../helpers";
import { stripUndefined } from "@/lib/utils";

export const tournamentsRouter = createTRPCRouter({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [totalTournaments, activeTournaments] = await Promise.all([
      ctx.prisma.tournament.count({
        where: { ownerId: ctx.userId, deletedAt: null },
      }),
      ctx.prisma.tournament.count({
        where: {
          ownerId: ctx.userId,
          deletedAt: null,
          status: "PUBLISHED",
        },
      }),
    ]);
    return { totalTournaments, activeTournaments };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.tournament.findMany({
      where: { ownerId: ctx.userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            rounds: true,
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
        description: z.string().optional(),
        format: z.enum(["ROUND_ROBIN", "SINGLE_ELIM", "DOUBLE_ELIM", "SWISS"]).optional(),
        startDate: z.string(),
        endDate: z.string(),
        timezone: z.string().default("Asia/Manila"),
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

      const tournament = await ctx.prisma.tournament.create({
        data: {
          name: input.name,
          slug,
          description: input.description || null,
          format: input.format || null,
          startDate: start,
          endDate: end,
          timezone: input.timezone,
          ownerId: ctx.userId,
          status: "DRAFT",
        },
      });

      // Auto-create a default round if format is provided
      if (input.format) {
        const roundNames: Record<string, string> = {
          ROUND_ROBIN: "Round Robin",
          SINGLE_ELIM: "Bracket",
          DOUBLE_ELIM: "Bracket",
          SWISS: "Swiss",
        };
        await ctx.prisma.round.create({
          data: {
            name: roundNames[input.format] ?? "Round 1",
            type: input.format,
            order: 0,
            tournamentId: tournament.id,
          },
        });
      }

      return tournament;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tournament = await ctx.prisma.tournament.findFirst({
        where: { id: input.id, ownerId: ctx.userId, deletedAt: null },
        include: { locations: true },
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      return tournament;
    }),

  getBySlug: baseProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const tournament = await ctx.prisma.tournament.findFirst({
        where: { slug: input.slug, deletedAt: null, status: { not: "DRAFT" } },
        include: {
          locations: true,
          teams: { orderBy: { seed: "asc" } },
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
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      return tournament;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        format: z.enum(["ROUND_ROBIN", "SINGLE_ELIM", "DOUBLE_ELIM", "SWISS", "CUSTOM"]).nullable().optional(),
        drawsAllowed: z.boolean().optional(),
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
        tiebreakerConfig: z
          .object({ order: z.array(z.string()) })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tournament = await verifyTournamentOwnership(
        ctx.prisma,
        input.id,
        ctx.userId
      );

      if (tournament.status === "COMPLETED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot update a completed tournament",
        });
      }

      const { id, ...data } = input;
      const updateData = stripUndefined({
        name: data.name,
        description: data.description,
        format: data.format,
        drawsAllowed: data.drawsAllowed,
        timezone: data.timezone,
        pointsConfig: data.pointsConfig,
        scoringConfig: data.scoringConfig,
        scheduleConfig: data.scheduleConfig,
        tiebreakerConfig: data.tiebreakerConfig,
        startDate: data.startDate !== undefined ? new Date(data.startDate) : undefined,
        endDate: data.endDate !== undefined ? new Date(data.endDate) : undefined,
      });

      return ctx.prisma.tournament.update({
        where: { id },
        data: updateData,
      });
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tournament = await verifyTournamentOwnership(ctx.prisma, input.id, ctx.userId);

      if (tournament.status !== "DRAFT") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only draft tournaments can be published",
        });
      }

      const [teamCount, gameCount] = await Promise.all([
        ctx.prisma.team.count({ where: { tournamentId: input.id } }),
        ctx.prisma.game.count({
          where: { round: { tournamentId: input.id } },
        }),
      ]);

      if (teamCount < 2) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Tournament must have at least 2 participants",
        });
      }
      if (gameCount === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Games must be generated before publishing",
        });
      }

      return ctx.prisma.tournament.update({
        where: { id: input.id },
        data: { status: "PUBLISHED" },
      });
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.id, ctx.userId);
      return ctx.prisma.tournament.update({
        where: { id: input.id },
        data: { status: "COMPLETED" },
      });
    }),

  reopen: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.id, ctx.userId);
      return ctx.prisma.tournament.update({
        where: { id: input.id },
        data: { status: "PUBLISHED" },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.id, ctx.userId);
      return ctx.prisma.tournament.update({
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

      const [tournaments, totalCount] = await Promise.all([
        ctx.prisma.tournament.findMany({
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
            format: true,
            startDate: true,
            endDate: true,
            _count: {
              select: {
                rounds: true,
                teams: true,
                locations: true,
              },
            },
          },
        }),
        ctx.prisma.tournament.count({ where }),
      ]);

      return {
        tournaments,
        totalCount,
        totalPages: Math.ceil(totalCount / input.pageSize),
        currentPage: input.page,
      };
    }),
});
