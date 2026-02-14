import { createTRPCRouter } from "../init";
import { authRouter } from "./auth";
import { tournamentsRouter } from "./tournaments";
import { locationsRouter } from "./locations";
import { teamsRouter } from "./teams";
import { roundsRouter } from "./rounds";
import { poolsRouter } from "./pools";
import { gamesRouter } from "./games";
import { coachRouter } from "./coach";
import { bookingsRouter } from "./bookings";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  tournaments: tournamentsRouter,
  locations: locationsRouter,
  teams: teamsRouter,
  rounds: roundsRouter,
  pools: poolsRouter,
  games: gamesRouter,
  coach: coachRouter,
  bookings: bookingsRouter,
});

export type AppRouter = typeof appRouter;
