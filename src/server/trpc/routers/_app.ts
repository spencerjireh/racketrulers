import { createTRPCRouter } from "../init";
import { authRouter } from "./auth";
import { tournamentsRouter } from "./tournaments";
import { locationsRouter } from "./locations";
import { participantsRouter } from "./participants";
import { matchesRouter } from "./matches";
import { coachRouter } from "./coach";
import { bookingsRouter } from "./bookings";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  tournaments: tournamentsRouter,
  locations: locationsRouter,
  participants: participantsRouter,
  matches: matchesRouter,
  coach: coachRouter,
  bookings: bookingsRouter,
});

export type AppRouter = typeof appRouter;
