import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { protectedProcedure, createTRPCRouter } from "../init";
import { verifyTournamentOwnership } from "../helpers";
import { stripUndefined } from "@/lib/utils";
import {
  generateRoundRobinGames,
  generateSingleElimGames,
  generateDoubleElimGames,
  generateSwissPairings,
} from "@/server/lib/game-generation";

export const roundsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      return ctx.prisma.round.findMany({
        where: { tournamentId: input.tournamentId },
        orderBy: { order: "asc" },
        include: {
          _count: { select: { pools: true, games: true } },
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string(), tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);
      const round = await ctx.prisma.round.findFirst({
        where: { id: input.id, tournamentId: input.tournamentId },
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
      });
      if (!round) throw new TRPCError({ code: "NOT_FOUND" });
      return round;
    }),

  create: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        name: z.string().min(1, "Name is required"),
        type: z.enum(["ROUND_ROBIN", "SINGLE_ELIM", "DOUBLE_ELIM", "SWISS", "CUSTOM"]),
        drawsAllowed: z.boolean().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(
        ctx.prisma,
        input.tournamentId,
        ctx.userId
      );

      const maxOrder = await ctx.prisma.round.aggregate({
        where: { tournamentId: input.tournamentId },
        _max: { order: true },
      });

      return ctx.prisma.round.create({
        data: {
          name: input.name,
          type: input.type,
          drawsAllowed: input.drawsAllowed ?? false,
          config: (input.config as Prisma.InputJsonValue) ?? undefined,
          order: (maxOrder._max.order ?? -1) + 1,
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
        drawsAllowed: z.boolean().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const updateData = stripUndefined({
        name: input.name,
        drawsAllowed: input.drawsAllowed,
        config: input.config,
      });

      return ctx.prisma.round.update({ where: { id: input.id }, data: updateData as Prisma.RoundUpdateInput });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const round = await ctx.prisma.round.findFirst({
        where: { id: input.id, tournamentId: input.tournamentId },
      });
      if (!round) throw new TRPCError({ code: "NOT_FOUND" });

      const inProgress = await ctx.prisma.game.count({
        where: { roundId: input.id, status: "IN_PROGRESS" },
      });
      if (inProgress > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot delete round with in-progress games",
        });
      }

      return ctx.prisma.round.delete({ where: { id: input.id } });
    }),

  generateGames: protectedProcedure
    .input(z.object({ id: z.string(), tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const round = await ctx.prisma.round.findFirst({
        where: { id: input.id, tournamentId: input.tournamentId },
        include: {
          pools: {
            include: {
              poolTeams: { orderBy: { seed: "asc" }, include: { team: true } },
            },
          },
        },
      });
      if (!round) throw new TRPCError({ code: "NOT_FOUND" });

      // Get tournament teams sorted by seed
      const teams = await ctx.prisma.team.findMany({
        where: { tournamentId: input.tournamentId },
        orderBy: { seed: "asc" },
      });

      const existingGames = await ctx.prisma.game.count({
        where: { roundId: input.id },
      });
      if (existingGames > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Games already exist. Clear them first before regenerating.",
        });
      }

      if (round.type === "ROUND_ROBIN") {
        if (round.pools.length === 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Create pools and assign teams before generating games",
          });
        }

        const allGames: {
          team1Id: string | null;
          team2Id: string | null;
          roundPosition: number;
          poolId: string | null;
          roundId: string;
          status: "SCHEDULED";
        }[] = [];

        let globalPosition = 1;
        for (const pool of round.pools) {
          const teamIds = pool.poolTeams.map((pt) => pt.teamId);
          if (teamIds.length < 2) continue;

          const games = generateRoundRobinGames(pool.id, teamIds);
          for (const g of games) {
            allGames.push({
              ...g,
              roundPosition: globalPosition++,
              roundId: round.id,
              status: "SCHEDULED",
            });
          }
        }

        await ctx.prisma.game.createMany({ data: allGames });
        return { gamesCreated: allGames.length };
      }

      if (round.type === "SINGLE_ELIM") {
        const teamIds = teams.map((t) => t.id);
        if (teamIds.length < 2) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Need at least 2 teams for single elimination",
          });
        }

        const consolation =
          (round.config as Record<string, unknown>)?.consolation_match === true;
        const gameSeeds = generateSingleElimGames(teamIds, consolation);

        const createdIds = await ctx.prisma.$transaction(async (tx) => {
          // Pass 1: Create all games without feeder links
          const ids: string[] = [];
          for (const g of gameSeeds) {
            const created = await tx.game.create({
              data: {
                team1Id: g.team1Id,
                team2Id: g.team2Id,
                roundPosition: g.roundPosition,
                roundId: round.id,
                status: "SCHEDULED",
              },
            });
            ids.push(created.id);
          }

          // Pass 2: Link feeder games using positional indices
          for (let i = 0; i < gameSeeds.length; i++) {
            const seed = gameSeeds[i];
            if (seed.feederIndex1 != null || seed.feederIndex2 != null) {
              await tx.game.update({
                where: { id: ids[i] },
                data: {
                  feederGame1Id: seed.feederIndex1 != null ? ids[seed.feederIndex1] : undefined,
                  feederGame2Id: seed.feederIndex2 != null ? ids[seed.feederIndex2] : undefined,
                },
              });
            }
          }

          // Pass 3: Auto-complete bye games (exactly one team is null)
          for (let i = 0; i < gameSeeds.length; i++) {
            const seed = gameSeeds[i];
            if ((seed.team1Id === null) !== (seed.team2Id === null)) {
              await tx.game.update({
                where: { id: ids[i] },
                data: {
                  status: "COMPLETED",
                  scoreTeam1: seed.team1Id ? 1 : 0,
                  scoreTeam2: seed.team2Id ? 1 : 0,
                  setScores: [{ team1: seed.team1Id ? 21 : 0, team2: seed.team2Id ? 21 : 0 }],
                },
              });
            }
          }

          return ids;
        });

        return { gamesCreated: createdIds.length };
      }

      if (round.type === "DOUBLE_ELIM") {
        const teamIds = teams.map((t) => t.id);
        if (teamIds.length < 2) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Need at least 2 teams for double elimination",
          });
        }

        const resetMatch =
          (round.config as Record<string, unknown>)?.reset_match !== false;
        const games = generateDoubleElimGames(teamIds, resetMatch);

        const createdIds: string[] = [];
        for (const g of games) {
          const created = await ctx.prisma.game.create({
            data: {
              team1Id: g.team1Id,
              team2Id: g.team2Id,
              roundPosition: g.roundPosition,
              roundId: round.id,
              status: "SCHEDULED",
            },
          });
          createdIds.push(created.id);
        }

        return { gamesCreated: createdIds.length };
      }

      if (round.type === "SWISS") {
        const teamIds = teams.map((t) => t.id);
        if (teamIds.length < 2) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Need at least 2 teams for Swiss pairings",
          });
        }

        const games = generateSwissPairings(teamIds);

        const allGames = games.map((g) => ({
          team1Id: g.team1Id,
          team2Id: g.team2Id,
          roundPosition: g.roundPosition,
          roundId: round.id,
          status: "SCHEDULED" as const,
        }));

        await ctx.prisma.game.createMany({ data: allGames });
        return { gamesCreated: allGames.length };
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unsupported round type: ${round.type}`,
      });
    }),

  clearGames: protectedProcedure
    .input(z.object({ id: z.string(), tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const blocked = await ctx.prisma.game.count({
        where: {
          roundId: input.id,
          status: { in: ["IN_PROGRESS", "COMPLETED"] },
        },
      });
      if (blocked > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot clear games that are in progress or completed",
        });
      }

      await ctx.prisma.game.deleteMany({ where: { roundId: input.id } });
    }),

  confirmResults: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        tournamentId: z.string(),
        force: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTournamentOwnership(ctx.prisma, input.tournamentId, ctx.userId);

      const round = await ctx.prisma.round.findFirst({
        where: { id: input.id, tournamentId: input.tournamentId },
      });
      if (!round) throw new TRPCError({ code: "NOT_FOUND" });

      const games = await ctx.prisma.game.findMany({
        where: { roundId: input.id },
      });

      const incomplete = games.filter(
        (g) => !["COMPLETED", "FORFEIT", "CANCELLED"].includes(g.status)
      );

      if (incomplete.length > 0 && !input.force) {
        return {
          confirmed: false,
          incompleteCount: incomplete.length,
          message: `${incomplete.length} game(s) are not yet completed. Use force to confirm anyway.`,
        };
      }

      await ctx.prisma.round.update({
        where: { id: input.id },
        data: { confirmed: true },
      });

      return { confirmed: true, incompleteCount: 0 };
    }),
});
