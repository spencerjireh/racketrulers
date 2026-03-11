import { cache } from "react";
import { createServerCaller } from "@/lib/trpc/server";

export const getTournamentBySlug = cache(async (slug: string) => {
  const caller = await createServerCaller();
  return caller.tournaments.getBySlug({ slug });
});
