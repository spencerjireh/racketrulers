import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { baseProcedure, protectedProcedure, createTRPCRouter } from "../init";

async function requireCoachProfile(prisma: PrismaClient) {
  const profile = await prisma.coachProfile.findFirst();
  if (!profile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Coach profile not configured.",
    });
  }
  return profile;
}

export const coachRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.coachProfile.findFirst({
      include: {
        availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        bookings: {
          where: {
            status: "CONFIRMED",
            date: { gte: new Date() },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          take: 20,
        },
      },
    });
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        sessionDurationMinutes: z.number().int().min(15).max(480),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await requireCoachProfile(ctx.prisma);

      return ctx.prisma.coachProfile.update({
        where: { id: profile.id },
        data: { sessionDurationMinutes: input.sessionDurationMinutes },
      });
    }),

  setAvailability: protectedProcedure
    .input(
      z.object({
        slots: z.array(
          z.object({
            dayOfWeek: z.number().int().min(0).max(6),
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
            endTime: z.string().regex(/^\d{2}:\d{2}$/),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await requireCoachProfile(ctx.prisma);

      await ctx.prisma.$transaction([
        ctx.prisma.coachAvailability.deleteMany({ where: { coachProfileId: profile.id } }),
        ctx.prisma.coachAvailability.createMany({
          data: input.slots.map((slot) => ({ ...slot, coachProfileId: profile.id })),
        }),
      ]);

      return { updated: input.slots.length };
    }),

  listBookings: protectedProcedure
    .input(
      z.object({
        status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(50).optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const profile = await requireCoachProfile(ctx.prisma);

      const dateFilter: Record<string, Date> = {};
      if (input.from) dateFilter.gte = new Date(input.from);
      if (input.to) dateFilter.lte = new Date(input.to);

      const where = {
        coachProfileId: profile.id,
        ...(input.status ? { status: input.status } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      };

      const [bookings, totalCount] = await Promise.all([
        ctx.prisma.booking.findMany({
          where,
          orderBy: [{ date: "desc" }, { startTime: "asc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.booking.count({ where }),
      ]);

      return {
        bookings,
        totalCount,
        totalPages: Math.ceil(totalCount / input.pageSize),
        currentPage: input.page,
      };
    }),

  cancelBooking: protectedProcedure
    .input(z.object({ bookingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await requireCoachProfile(ctx.prisma);

      const booking = await ctx.prisma.booking.findFirst({
        where: { id: input.bookingId, coachProfileId: profile.id },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.booking.update({
        where: { id: input.bookingId },
        data: { status: "CANCELLED" },
      });
    }),

  getPublic: baseProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const coach = await ctx.prisma.coachProfile.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          displayName: true,
          slug: true,
          sessionDurationMinutes: true,
          _count: { select: { availability: true } },
        },
      });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND" });
      return coach;
    }),
});
