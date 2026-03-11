import "server-only";
import { cache } from "react";
import { createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";
import { createCallerFactory } from "@/server/trpc/init";

const createCaller = createCallerFactory(appRouter);

// Wrap the tRPC caller proxy so that serialization helpers like
// .toJSON / Symbol.toPrimitive (used by Next.js RSC) don't get
// forwarded to the tRPC proxy's get-trap, which would throw
// "No procedure found on path toJSON".
function wrapCaller<T extends object>(caller: T): T {
  return new Proxy(caller, {
    get(target, prop, receiver) {
      if (prop === "toJSON") return () => "[tRPC caller]";
      return Reflect.get(target, prop, receiver);
    },
  }) as T;
}

export const createServerCaller = cache(async () => {
  const ctx = await createTRPCContext();
  return wrapCaller(createCaller(ctx));
});
