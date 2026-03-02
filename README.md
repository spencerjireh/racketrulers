# RacketRulers

Badminton tournament management and coach scheduling platform.

## Features

- Create and manage tournaments with multiple formats (round robin, single elimination, double elimination, swiss)
- Automatic bracket generation and game scheduling
- Real-time score updates via WebSocket (Soketi/Pusher protocol)
- Configurable scoring rules, tiebreakers, and point systems
- Team seeding and pool assignments
- Live standings with configurable tiebreaker logic
- Coach booking system with public booking pages
- Invite-based signup

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui
- **Database**: PostgreSQL (Neon), Prisma 6
- **API**: tRPC v11
- **Auth**: NextAuth v5 (JWT + Credentials)
- **Realtime**: Soketi (Pusher protocol)
- **Testing**: Vitest, Playwright

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (Neon recommended)
- Soketi instance for realtime features

### Setup

```bash
npm install
cp .env.example .env   # configure your environment variables
npm run db:migrate      # run database migrations
npm run db:seed         # seed initial data
npm run dev             # start dev server on port 3000
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |

## License

Private
