import { createTRPCRouter } from "../init";
import { authRouter } from "./auth";
import { eventsRouter } from "./events";
import { locationsRouter } from "./locations";
import { teamsRouter } from "./teams";
import { categoriesRouter } from "./categories";
import { roundsRouter } from "./rounds";
import { poolsRouter } from "./pools";
import { gamesRouter } from "./games";
import { coachRouter } from "./coach";
import { bookingsRouter } from "./bookings";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  events: eventsRouter,
  locations: locationsRouter,
  teams: teamsRouter,
  categories: categoriesRouter,
  rounds: roundsRouter,
  pools: poolsRouter,
  games: gamesRouter,
  coach: coachRouter,
  bookings: bookingsRouter,
});

export type AppRouter = typeof appRouter;
