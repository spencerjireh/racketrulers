import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const createTRPCContext = cache(async () => {
  const session = await auth();
  return {
    prisma,
    session,
    userId: session?.user?.id ?? null,
  };
});

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause as Record<string, unknown> | undefined;
    return {
      ...shape,
      data: {
        ...shape.data,
        cause:
          cause && typeof cause === "object" && "type" in cause
            ? { type: cause.type, downstreamCount: cause.downstreamCount, scoredCount: cause.scoredCount }
            : undefined,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

export const baseProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      session: ctx.session,
    },
  });
});
