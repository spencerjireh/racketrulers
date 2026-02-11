import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, createTRPCRouter } from "../init";

export const coachRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.coachProfile.findUnique({
      where: { userId: ctx.userId },
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

  createProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1, "Display name is required"),
        slug: z
          .string()
          .min(3)
          .max(50)
          .regex(
            /^[a-z0-9-]+$/,
            "Slug must contain only lowercase letters, numbers, and hyphens"
          ),
        sessionDurationMinutes: z.number().int().min(15).max(480).optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.coachProfile.findUnique({
        where: { userId: ctx.userId },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Coach profile already exists",
        });
      }

      const slugTaken = await ctx.prisma.coachProfile.findUnique({
        where: { slug: input.slug },
      });
      if (slugTaken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This slug is already taken",
        });
      }

      return ctx.prisma.coachProfile.create({
        data: {
          displayName: input.displayName,
          slug: input.slug,
          sessionDurationMinutes: input.sessionDurationMinutes ?? 60,
          timezone: input.timezone ?? "America/Toronto",
          userId: ctx.userId,
        },
      });
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
      const profile = await ctx.prisma.coachProfile.findUnique({
        where: { userId: ctx.userId },
      });
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No coach profile found" });
      }

      const updateData: Record<string, unknown> = {};
      if (input.displayName !== undefined) updateData.displayName = input.displayName;
      if (input.sessionDurationMinutes !== undefined)
        updateData.sessionDurationMinutes = input.sessionDurationMinutes;
      if (input.timezone !== undefined) updateData.timezone = input.timezone;

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
      const profile = await ctx.prisma.coachProfile.findUnique({
        where: { userId: ctx.userId },
      });
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No coach profile found" });
      }

      // Replace all availability atomically
      await ctx.prisma.$transaction([
        ctx.prisma.coachAvailability.deleteMany({
          where: { coachProfileId: profile.id },
        }),
        ...input.slots.map((slot) =>
          ctx.prisma.coachAvailability.create({
            data: {
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              coachProfileId: profile.id,
            },
          })
        ),
      ]);

      return { updated: input.slots.length };
    }),

  listBookings: protectedProcedure
    .input(
      z.object({
        status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const profile = await ctx.prisma.coachProfile.findUnique({
        where: { userId: ctx.userId },
      });
      if (!profile) return [];

      return ctx.prisma.booking.findMany({
        where: {
          coachProfileId: profile.id,
          ...(input.status ? { status: input.status } : {}),
          ...(input.from ? { date: { gte: new Date(input.from) } } : {}),
          ...(input.to ? { date: { lte: new Date(input.to) } } : {}),
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      });
    }),

  cancelBooking: protectedProcedure
    .input(z.object({ bookingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.prisma.coachProfile.findUnique({
        where: { userId: ctx.userId },
      });
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const booking = await ctx.prisma.booking.findFirst({
        where: { id: input.bookingId, coachProfileId: profile.id },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.booking.update({
        where: { id: input.bookingId },
        data: { status: "CANCELLED" },
      });
    }),
});
