import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure, createTRPCRouter } from "../init";

export const bookingsRouter = createTRPCRouter({
  getCoachPublic: baseProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.prisma.coachProfile.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          displayName: true,
          slug: true,
          sessionDurationMinutes: true,
          timezone: true,
        },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      return profile;
    }),

  getAvailableSlots: baseProcedure
    .input(
      z.object({
        slug: z.string(),
        from: z.string(),
        to: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const profile = await ctx.prisma.coachProfile.findUnique({
        where: { slug: input.slug },
        include: { availability: true },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      const fromDate = new Date(input.from);
      const toDate = new Date(input.to);

      // Max 8 weeks
      const maxRange = 56 * 24 * 60 * 60 * 1000;
      if (toDate.getTime() - fromDate.getTime() > maxRange) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Maximum 8-week range for slot calculation",
        });
      }

      // Fetch existing bookings in range
      const bookings = await ctx.prisma.booking.findMany({
        where: {
          coachProfileId: profile.id,
          status: "CONFIRMED",
          date: { gte: fromDate, lte: toDate },
        },
      });

      const bookedSlots = new Set(
        bookings.map((b) => `${b.date.toISOString().split("T")[0]}_${b.startTime}`)
      );

      const duration = profile.sessionDurationMinutes;
      const now = new Date();
      const slots: Record<string, string[]> = {};

      // Iterate through each date in range
      const current = new Date(fromDate);
      while (current <= toDate) {
        const dateStr = current.toISOString().split("T")[0];
        // dayOfWeek: 0=Monday in schema, but JS Date: 0=Sunday
        const jsDay = current.getDay();
        const schemaDay = jsDay === 0 ? 6 : jsDay - 1; // Convert to Mon=0

        const dayAvailability = profile.availability.filter(
          (a) => a.dayOfWeek === schemaDay
        );

        const daySlots: string[] = [];

        for (const window of dayAvailability) {
          const [startH, startM] = window.startTime.split(":").map(Number);
          const [endH, endM] = window.endTime.split(":").map(Number);
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;

          for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
            const hours = Math.floor(m / 60);
            const mins = m % 60;
            const timeStr = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
            const slotKey = `${dateStr}_${timeStr}`;

            // Skip if booked or in the past
            if (bookedSlots.has(slotKey)) continue;

            const slotDate = new Date(current);
            slotDate.setHours(hours, mins, 0, 0);
            if (slotDate <= now) continue;

            daySlots.push(timeStr);
          }
        }

        if (daySlots.length > 0) {
          slots[dateStr] = daySlots;
        }

        current.setDate(current.getDate() + 1);
      }

      return slots;
    }),

  create: baseProcedure
    .input(
      z.object({
        slug: z.string(),
        date: z.string(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        bookerName: z.string().min(1, "Name is required"),
        bookerEmail: z.string().email("Valid email required"),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.prisma.coachProfile.findUnique({
        where: { slug: input.slug },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      // Calculate end time
      const [startH, startM] = input.startTime.split(":").map(Number);
      const totalMinutes = startH * 60 + startM + profile.sessionDurationMinutes;
      const endH = Math.floor(totalMinutes / 60);
      const endM = totalMinutes % 60;
      const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

      // Race condition guard: check if slot is still available
      const existingBooking = await ctx.prisma.booking.findFirst({
        where: {
          coachProfileId: profile.id,
          date: new Date(input.date),
          startTime: input.startTime,
          status: "CONFIRMED",
        },
      });
      if (existingBooking) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This time slot has already been booked",
        });
      }

      return ctx.prisma.booking.create({
        data: {
          date: new Date(input.date),
          startTime: input.startTime,
          endTime,
          bookerName: input.bookerName,
          bookerEmail: input.bookerEmail,
          message: input.message || null,
          coachProfileId: profile.id,
        },
      });
    }),
});
