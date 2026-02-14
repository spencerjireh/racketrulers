# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (Turbopack, port 3000)
npm run build            # Production build
npm run lint             # ESLint
npm run test             # Vitest unit tests
npm run test -- --run src/path/to/file.test.ts  # Run a single test file
npm run test:e2e         # Playwright E2E tests (./e2e/)
npm run db:migrate       # Prisma migrate dev
npm run db:seed          # Seed database (tsx prisma/seed.ts)
npm run db:studio        # Prisma Studio GUI
npx prisma generate      # Regenerate Prisma client after schema changes
```

## Architecture

**RacketRulers** -- badminton tournament management + coach scheduling platform.

### Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4 (inline `@theme` config, no tailwind.config.js), shadcn/ui (New York style), Prisma 6, NextAuth v5 beta, tRPC v11, Soketi (Pusher protocol) for realtime, Neon PostgreSQL.

### Path alias

`@/*` maps to `./src/*`.

### tRPC wiring

- **Server init**: `src/server/trpc/init.ts` -- creates context with `prisma`, `session`, `userId`. Exports `baseProcedure` (public) and `protectedProcedure` (auth-required).
- **Routers**: `src/server/trpc/routers/_app.ts` -- merges: auth, tournaments, locations, teams, rounds, pools, games, coach, bookings.
- **Client (React)**: `src/lib/trpc/client.tsx` -- uses `createTRPCContext` from `@trpc/tanstack-react-query`. The `TRPCProvider` prop is `trpcClient` (NOT `client`). Use `useTRPC()` hook to get the tRPC proxy in client components.
- **Server caller**: `src/lib/trpc/server.ts` -- `createServerCaller()` for calling tRPC from Server Components / Server Actions.

### Auth

- `src/lib/auth.ts` exports `{ handlers, signIn, signOut, auth }` (NextAuth v5 pattern).
- JWT strategy with Credentials provider, bcryptjs for passwords.
- `src/lib/auth-helpers.ts` -- `getRequiredSession()` for protected Server Component pages (redirects to /login).
- Signup requires invite code (configured via `INVITE_CODES` env var).

### Database

- Prisma schema: `prisma/schema.prisma` (PostgreSQL on Neon).
- Singleton client: `src/lib/prisma.ts`.
- Two connection strings: `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) -- both required.
- After changing the schema: run `npm run db:migrate` then `npx prisma generate`.

### Realtime (Soketi / Pusher protocol)

- Server: `src/lib/socket.ts` -- `emitToTournament(tournamentId, eventName, payload)` using `pusher` server SDK.
- Client: `src/hooks/use-socket.ts` -- singleton `pusher-js` instance, `useSocket(tournamentId)` hook.
- Auto-invalidation: `src/hooks/use-realtime-event.ts` -- `useRealtimeTournament()` invalidates TanStack Query caches on WS events.
- Channel pattern: `tournament.{tournamentId}`. Event names: `score:updated`, `schedule:updated`, `tournament:updated`.

### Tournament data model

Tournament -> Round -> Pool -> Game. Teams belong directly to a Tournament (with a `seed` field) and are assigned to pools via PoolTeam. Games have feeder game relations for bracket advancement. Scores use set-based scoring (`setScores` JSON array + `scoreTeam1`/`scoreTeam2` integers). Tournament has `format` (RoundType), `drawsAllowed`, `scoringConfig`, `tiebreakerConfig`, and `pointsConfig` fields.

### Server business logic

- `src/server/lib/game-generation.ts` -- generates matchups for round robin, single elim, double elim, swiss.
- `src/server/lib/standings.ts` -- calculates standings with configurable tiebreakers.
- `src/server/lib/scoring-validation.ts` -- validates set scores against tournament scoring config.
- `src/server/trpc/helpers.ts` -- `verifyTournamentOwnership()` authorization helper.

### Route structure

- Public: `/` (landing), `/tournaments` (explore), `/tournaments/[slug]` (tournament page), `/tournaments/[slug]/bracket`, `/tournaments/[slug]/standings`, `/book/[slug]` (coach booking)
- Auth: `/(auth)/login`, `/(auth)/signup`
- Dashboard: `/(dashboard)/dashboard/tournaments/[id]/manage/{settings,participants,bracket}`, `/(dashboard)/dashboard/tournaments/new`
- Coach: `/(dashboard)/dashboard/coach`
- API: `/api/auth/[...nextauth]`, `/api/trpc/[trpc]`
- Redirects: `/events/*` -> `/tournaments/*`, `/dashboard/events/*` -> `/dashboard/tournaments/*`

## Key conventions

- Use `sonner` for toast notifications (shadcn/ui `toast` is deprecated).
- Prisma v6 only -- v7 had P1010 auth errors with Neon.
- Soketi config requires `cluster: ""` in pusher-js (not a real Pusher cluster).
- Tournament soft-deletes use `deletedAt` field -- always filter with `deletedAt: null` in queries.
- All Prisma model fields use `@map()` for snake_case DB columns; TypeScript uses camelCase.
