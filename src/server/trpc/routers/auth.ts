import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { baseProcedure, protectedProcedure, createTRPCRouter } from "../init";

export const authRouter = createTRPCRouter({
  signup: baseProcedure
    .input(
      z.object({
        inviteCode: z.string().min(1, "Invite code is required"),
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rawCodes = process.env.INVITE_CODES;
      if (!rawCodes) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Signup is currently disabled",
        });
      }

      const validCodes = rawCodes.split(",").map((c) => c.trim().toUpperCase());
      if (!validCodes.includes(input.inviteCode.trim().toUpperCase())) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid invite code",
        });
      }

      const existing = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 12);

      const user = await ctx.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
        },
      });

      return { id: user.id, email: user.email };
    }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return user;
  }),
});
