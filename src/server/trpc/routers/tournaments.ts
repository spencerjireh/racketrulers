import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure, protectedProcedure, createTRPCRouter } from "../init";
import { generateUniqueSlug } from "@/lib/slug";
import { verifyTournamentOwnership } from "../helpers";
import { stripUndefined } from "@/lib/utils";
import {
  generateRoundRobinGames,
  generateSingleElimGames,
  generateDoubleElimGames,
  generateSwissPairings,
} from "@/server/lib/game-generation";
import { emitToTournament } from "@/lib/socket";
import { calculateStandings } from "@/server/lib/standings";

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
          status: "UNDERWAY",
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
            matches: true,
            participants: true,
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
        thirdPlaceMatch: z.boolean().optional(),
        grandFinalsModifier: z.string().optional(),
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
          status: "PENDING",
          thirdPlaceMatch: input.thirdPlaceMatch ?? false,
          grandFinalsModifier: input.grandFinalsModifier || null,
        },
      });

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
        where: { slug: input.slug, deletedAt: null, status: { not: "PENDING" } },
        include: {
          locations: true,
          participants: { orderBy: { seed: "asc" } },
          _count: { select: { matches: true } },
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
        format: z.enum(["ROUND_ROBIN", "SINGLE_ELIM", "DOUBLE_ELIM", "SWISS"]).nullable().optional(),
        drawsAllowed: z.boolean().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        timezone: z.string().optional(),
        thirdPlaceMatch: z.boolean().optional(),
        grandFinalsModifier: z.string().optional(),
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

      if (tournament.status === "COMPLETE") {
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
        thirdPlaceMatch: data.thirdPlaceMatch,
        grandFinalsModifier: data.grandFinalsModifier,
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

  start: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tournament = await verifyTournamentOwnership(ctx.prisma, input.id, ctx.userId);

      if (tournament.status !== "PENDING") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only pending tournaments can be started",
        });
      }

      const participantCount = await ctx.prisma.participant.count({
        where: { tournamentId: input.id },
      });
      if (participantCount < 2) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Tournament must have at least 2 participants",
        });
      }

      const participants = await ctx.prisma.participant.findMany({
        where: { tournamentId: input.id },
        orderBy: { seed: "asc" },
      });
      const participantIds = participants.map((p) => p.id);

      await ctx.prisma.$transaction(async (tx) => {
        // Clear any existing matches (in case of re-start)
        await tx.match.deleteMany({ where: { tournamentId: input.id } });

        if (tournament.format === "ROUND_ROBIN") {
          const matchSeeds = generateRoundRobinGames(participantIds);
          await tx.match.createMany({
            data: matchSeeds.map((m) => ({
              participant1Id: m.participant1Id,
              participant2Id: m.participant2Id,
              roundPosition: m.roundPosition,
              round: 1,
              tournamentId: input.id,
              status: "PENDING" as const,
            })),
          });
        } else if (tournament.format === "SINGLE_ELIM") {
          const consolation = tournament.thirdPlaceMatch;
          const gameSeeds = generateSingleElimGames(participantIds, consolation);

          // Pass 1: Create all matches without feeder links
          const ids: string[] = [];
          for (const g of gameSeeds) {
            const created = await tx.match.create({
              data: {
                participant1Id: g.participant1Id,
                participant2Id: g.participant2Id,
                roundPosition: g.roundPosition,
                round: (g.bracketRound ?? 0) + 1,
                tournamentId: input.id,
                status: "PENDING" as const,
              },
            });
            ids.push(created.id);
          }

          // Pass 2: Link feeder matches using positional indices
          for (let i = 0; i < gameSeeds.length; i++) {
            const seed = gameSeeds[i];
            if (seed.feederIndex1 != null || seed.feederIndex2 != null) {
              await tx.match.update({
                where: { id: ids[i] },
                data: {
                  feederMatch1Id: seed.feederIndex1 != null ? ids[seed.feederIndex1] : undefined,
                  feederMatch2Id: seed.feederIndex2 != null ? ids[seed.feederIndex2] : undefined,
                },
              });
            }
          }

          // Pass 3: Auto-complete bye matches (exactly one participant is null)
          for (let i = 0; i < gameSeeds.length; i++) {
            const seed = gameSeeds[i];
            if ((seed.participant1Id === null) !== (seed.participant2Id === null)) {
              await tx.match.update({
                where: { id: ids[i] },
                data: {
                  status: "COMPLETE" as const,
                  scoreParticipant1: seed.participant1Id ? 1 : 0,
                  scoreParticipant2: seed.participant2Id ? 1 : 0,
                  setScores: [{ team1: seed.participant1Id ? 21 : 0, team2: seed.participant2Id ? 21 : 0 }],
                },
              });
            }
          }
        } else if (tournament.format === "DOUBLE_ELIM") {
          const resetMatch = tournament.grandFinalsModifier !== "GRAND_FINALS_SINGLE_MATCH";
          const gameSeeds = generateDoubleElimGames(participantIds, resetMatch);

          const ids: string[] = [];
          for (const g of gameSeeds) {
            const created = await tx.match.create({
              data: {
                participant1Id: g.participant1Id,
                participant2Id: g.participant2Id,
                roundPosition: g.roundPosition,
                round: (g.bracketRound ?? 0) + 1,
                tournamentId: input.id,
                status: "PENDING" as const,
              },
            });
            ids.push(created.id);
          }

          // Link feeder matches
          for (let i = 0; i < gameSeeds.length; i++) {
            const seed = gameSeeds[i];
            if (seed.feederIndex1 != null || seed.feederIndex2 != null) {
              await tx.match.update({
                where: { id: ids[i] },
                data: {
                  feederMatch1Id: seed.feederIndex1 != null ? ids[seed.feederIndex1] : undefined,
                  feederMatch2Id: seed.feederIndex2 != null ? ids[seed.feederIndex2] : undefined,
                },
              });
            }
          }
        } else if (tournament.format === "SWISS") {
          const matchSeeds = generateSwissPairings(participantIds);
          await tx.match.createMany({
            data: matchSeeds.map((m) => ({
              participant1Id: m.participant1Id,
              participant2Id: m.participant2Id,
              roundPosition: m.roundPosition,
              round: 1,
              tournamentId: input.id,
              status: "PENDING" as const,
            })),
          });
        }

        await tx.tournament.update({
          where: { id: input.id },
          data: { status: "UNDERWAY" },
        });
      });

      emitToTournament(input.id, "tournament:updated", { status: "UNDERWAY" });
      return ctx.prisma.tournament.findFirst({ where: { id: input.id } });
    }),

  finalize: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.id, ctx.userId);
      return ctx.prisma.tournament.update({
        where: { id: input.id },
        data: { status: "COMPLETE" },
      });
    }),

  reopen: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.id, ctx.userId);
      return ctx.prisma.tournament.update({
        where: { id: input.id },
        data: { status: "UNDERWAY" },
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
        status: { not: "PENDING" },
      };

      if (input.search) {
        where.name = { contains: input.search, mode: "insensitive" };
      }

      if (input.status === "upcoming") {
        where.status = "UNDERWAY";
        where.startDate = { gt: now };
      } else if (input.status === "in-progress") {
        where.status = "UNDERWAY";
        where.startDate = { lte: now };
        where.endDate = { gte: now };
      } else if (input.status === "completed") {
        where.status = "COMPLETE";
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
                matches: true,
                participants: true,
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

  generateNextSwissRound: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tournament = await verifyTournamentOwnership(ctx.prisma, input.id, ctx.userId);

      if (tournament.format !== "SWISS") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This tournament is not Swiss format",
        });
      }

      const matches = await ctx.prisma.match.findMany({
        where: { tournamentId: input.id },
        include: {
          participant1: { select: { id: true, name: true } },
          participant2: { select: { id: true, name: true } },
        },
      });

      const pointsConfig = tournament.pointsConfig as { win: number; draw: number; loss: number };
      const tiebreakerConfig = tournament.tiebreakerConfig as { order: string[] };

      const standings = calculateStandings(matches, pointsConfig, tiebreakerConfig);

      const previousResults = standings.map((s) => ({
        teamId: s.participantId,
        wins: s.wins,
        losses: s.losses,
      }));

      const participantIds = standings.map((s) => s.participantId);
      const matchSeeds = generateSwissPairings(participantIds, previousResults);

      const maxRound = matches.reduce((max, m) => Math.max(max, m.round ?? 0), 0);

      await ctx.prisma.match.createMany({
        data: matchSeeds.map((m) => ({
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          roundPosition: m.roundPosition,
          round: maxRound + 1,
          tournamentId: input.id,
          status: "PENDING" as const,
        })),
      });

      return { matchesCreated: matchSeeds.length, round: maxRound + 1 };
    }),
});
