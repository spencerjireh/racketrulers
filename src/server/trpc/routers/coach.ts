import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { baseProcedure, protectedProcedure, createTRPCRouter } from "../init";
import { stripUndefined } from "@/lib/utils";
import { COACH_SLUG } from "@/lib/constants";

async function getCoachProfile(prisma: PrismaClient) {
  const profile = await prisma.coachProfile.findUnique({
    where: { slug: COACH_SLUG },
  });
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
    const profile = await ctx.prisma.coachProfile.findUnique({
      where: { slug: COACH_SLUG },
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
    return profile;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).optional(),
        sessionDurationMinutes: z.number().int().min(15).max(480).optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await getCoachProfile(ctx.prisma);

      const updateData = stripUndefined({
        displayName: input.displayName,
        sessionDurationMinutes: input.sessionDurationMinutes,
        timezone: input.timezone,
      });

      return ctx.prisma.coachProfile.update({
        where: { id: profile.id },
        data: updateData,
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
      const profile = await getCoachProfile(ctx.prisma);

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
      const profile = await getCoachProfile(ctx.prisma);

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
      const profile = await getCoachProfile(ctx.prisma);

      const booking = await ctx.prisma.booking.findFirst({
        where: { id: input.bookingId, coachProfileId: profile.id },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.booking.update({
        where: { id: input.bookingId },
        data: { status: "CANCELLED" },
      });
    }),

  getPublic: baseProcedure.query(async ({ ctx }) => {
    const coach = await ctx.prisma.coachProfile.findUnique({
      where: { slug: COACH_SLUG },
      select: {
        id: true,
        displayName: true,
        slug: true,
        sessionDurationMinutes: true,
        timezone: true,
        _count: { select: { availability: true } },
      },
    });
    if (!coach) throw new TRPCError({ code: "NOT_FOUND" });
    return coach;
  }),
});
