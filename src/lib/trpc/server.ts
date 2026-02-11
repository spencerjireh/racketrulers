import "server-only";
import { createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";
import { createCallerFactory } from "@/server/trpc/init";

const createCaller = createCallerFactory(appRouter);

export async function createServerCaller() {
  const ctx = await createTRPCContext();
  return createCaller(ctx);
}
