# RacketRulers -- Product Requirements Document & Technical Specification

**Version:** 3.0
**Date:** February 11, 2026
**Status:** Ready for Development

---

## 1. Overview

### 1.1 Product Summary

RacketRulers is a badminton tournament management platform with two core modules:

1. **Tournament Management** -- Organizers create, schedule, and run tournaments. Spectators view schedules, live scores, and standings in real time.
2. **Coach Scheduler** -- Coaches publish their availability and share a booking link. Parents and players book sessions without needing an account.

The two modules are independent. A user can use one or both.

### 1.2 Target Users

| Persona | Description |
|---------|-------------|
| **Organizer** | Creates and manages tournaments. Needs schedule tools, score entry, and event customization. Single organizer per event in MVP. |
| **Coach** | Publishes availability for coaching sessions. Shares a booking link with parents/players. |
| **Spectator** | Views public event pages, schedules, and live scores. No account required. |
| **Booker** | A parent or player who books a coaching session. No account required. |

### 1.3 Design Principles

- **Manual-first**: Automate only what is obviously and quickly automatable. Everything else is manual with a clear path to automation later.
- **Organizer-first**: Every tournament feature should reduce organizer workload on tournament day.
- **Real-time by default**: Scores, standings, and schedule changes propagate instantly via WebSocket.
- **Badminton-focused**: The data model and UI are designed specifically for badminton. Scoring uses configurable set-based rules (points per set, best-of-N sets, deuce rules). Matches support singles and doubles designation.
- **Mobile-ready**: Organizers submit scores from the court/field. The entire admin flow must work on mobile via responsive web.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14+ (App Router), React, TypeScript | Modern React framework, App Router for layouts and routing |
| Styling | Tailwind CSS + shadcn/ui | Rapid UI development, consistent design system |
| Backend / API | Next.js API Routes + tRPC | Co-located with frontend; tRPC gives end-to-end type safety |
| Real-time | Socket.IO (Node server, sidecar process) | Live score/standings updates |
| Database | PostgreSQL | Relational model fits tournament structures well; JSON support for flexible configs |
| ORM | Prisma | Type-safe queries, migration tooling, Postgres-native |
| Auth | NextAuth.js (Auth.js) | Self-hosted, email/password credentials, no vendor lock-in, no cost ceiling |
| File Storage | S3-compatible object storage (e.g., DigitalOcean Spaces, Cloudflare R2) | Banner images. Provider TBD. |
| Local Dev | Docker Compose | PostgreSQL + app + Socket.IO server for local development |
| Production Hosting | Docker Compose on a VPS | Provider TBD. Self-hosted, cost-effective. |
| CI/CD | GitHub Actions | Build, test, deploy |
| Testing | Vitest (unit), Playwright (E2E critical paths) | Fast, modern |
| Bracket UI | Existing React bracket library (e.g., react-brackets) | Avoid building complex bracket visualization from scratch |

### 2.1 Explicitly Not in MVP

- Redis (no horizontal scaling needed yet)
- Email service (no transactional emails)
- Analytics / tracking
- i18n (English only)
- Dark mode
- SSR (all pages are client-side rendered; events are shared via direct links/QR codes, SEO is not a priority)
- Self-service team registration (organizer adds teams manually)
- Multi-admin / co-admin support
- Dynamic game assignment (organizer manually assigns bracket games to time slots)
- Automatic cascade recalculation (score edits require manual re-advancement)

---

## 3. User Roles & Permissions

### 3.1 Role Model

```
Platform Level:
  - Unauthenticated User: browse public event pages, view schedules/scores/brackets,
                           book coaching sessions (no account needed)
  - Authenticated User: create/manage events, manage coach availability

Event Level (scoped per tournament):
  - Owner: full control over the event (only one owner per event in MVP)
```

MVP simplification: each event has exactly one owner (the creator). Multi-admin support is deferred to post-MVP.

---

## 4. Core Features -- MVP

### 4.1 Event Management

**Create Event (Minimal)**
- Minimal creation form: event name, date range (single or multi-day), timezone (organizer's local timezone).
- After creation, organizer lands in the dashboard to configure everything else.

**Event Dashboard**
- Central hub for managing all aspects of the event.
- Sections: teams, categories, format/rounds, schedule, scores, settings.

**Event Settings**
- Edit event details (name, dates, description, sport type).
- Custom banner image upload (recommend 1200x400px, max 5MB, JPEG/PNG/WebP).
- Visibility: Published (publicly accessible via URL) or Completed (read-only, editing disabled).
- Configurable points system (see 4.9).
- Configurable tie/draw allowance per round type.

**Event Lifecycle**
- Two states: **Published** and **Completed**.
- Published: event is live, organizer can manage, anyone with the link can view.
- Completed: same public page but all editing is disabled. No special summary view -- the existing event page remains as-is in a frozen state.
- No draft state -- events are accessible via direct link/QR immediately upon creation.

**Event Deletion**
- Soft-delete with 30-day retention.
- After 30 days, permanently deleted.
- Only the Owner can delete.

### 4.2 Categories

- An event contains one or more categories (e.g., "Men's A", "Women's Open", "U18").
- Each category has its own format (rounds), teams, schedule, and standings.
- Categories are displayed as tabs or sections on the public event page.
- Teams are assigned to categories by the organizer.

### 4.3 Tournament Formats

Each category is configured with a multi-round format. Rounds are composable: an organizer can chain a Round Robin pool stage into a Single Elimination playoff, for example.

#### 4.3.1 Round Robin

- Teams divided into pools.
- Every team plays every other team in their pool.
- Configurable: number of pools, pool size (auto-balanced or manual assignment).
- Standings calculated per pool based on configured tiebreakers and points system.
- Draws allowed if configured.

#### 4.3.2 Swiss Ladder

- Fixed number of rounds.
- **Organizer manually pairs teams each round** (system does not auto-pair).
- No elimination; all teams play every round.
- Standings based on configured points and tiebreakers.

#### 4.3.3 Single Elimination

- Bracket seeded by pool standings or manual seeding.
- Losers eliminated.
- Support for byes when team count is not a power of 2.
- **3rd place (consolation) match** -- configurable.
- Interactive bracket visualization (using bracket library).

#### 4.3.4 Double Elimination

- Winners bracket + losers bracket.
- Team must lose twice to be eliminated.
- Grand final: losers bracket winner vs. winners bracket winner.
- **Reset match is configurable** (if losers bracket winner wins the grand final, optional second match).
- 3rd place match configurable.

#### 4.3.5 Custom Bracket

- Organizer manually defines matchups for each round.
- Drag-and-drop bracket editor.
- Used for non-standard formats or special consolation rounds.

#### 4.3.6 Multi-Round Composition

- Organizer defines an ordered list of rounds for a category.
- Advancement rules connect rounds: "Top 2 from each pool advance to Single Elimination."
- **Organizer manually triggers advancement.** System seeds the next round based on current standings when triggered.

### 4.4 Seeding

- Organizer assigns seed numbers to teams before the tournament starts.
- Seeds determine pool placement (snake draft across pools) and bracket positioning.
- Option to randomize seeds.
- Seeding is per-category.

### 4.5 Tiebreakers

Organizer selects an ordered list of tiebreakers from available options:

1. Win/loss record
2. Head-to-head result
3. Point differential (overall or head-to-head)
4. Points scored
5. Points allowed

Configured per category. Custom formulas are post-MVP.

### 4.6 Schedule Management

**Matchup Generation (Automated)**
- System auto-generates the list of matchups from the configured format (e.g., all round robin pairings, bracket matchups).
- This is the "obviously automatable" part.

**Time/Location Assignment (Manual)**
- Organizer manually assigns each game to a time slot and location using a drag-and-drop schedule grid.
- Grid dimensions: time slots (rows) x locations (columns), one day at a time.
- Conflict detection highlights issues (team double-booked, overlapping times).
- Changes saved immediately (optimistic UI).

**Multi-Day Support**
- Schedule grid shows one day at a time with day navigation.
- Organizer configures time windows per day (start time, end time).

**Locations**
- Simple named list of courts managed by the organizer (e.g., "Court 1", "Court 2"). UI labels display "Courts" instead of "Locations".

### 4.7 Score Entry & Results

**Who can enter scores:** Owner only (single-admin MVP).

**Score format:**
- Set-based scoring: `{ setScores: [{ team1: 21, team2: 18 }, { team1: 15, team2: 21 }, { team1: 21, team2: 19 }] }`. `scoreTeam1`/`scoreTeam2` store sets won (e.g., 2 and 1) for standings calculations.

**Score editing:**
- Scores are always editable, even after bracket advancement.
- **No automatic cascade.** When a score edit changes standings, the organizer must manually re-trigger advancement for affected rounds. The system warns the organizer that standings have changed and advancement may be stale.
- Standings recalculate automatically on any score change.

**On score submission:**
- Standings recalculate automatically.
- WebSocket event broadcasts to all connected clients.

**Forfeits & Cancellations**
- Organizer can mark a game as forfeit (assign win to one team) or cancelled (game ignored in standings).
- Forfeit/cancellation status is visually distinct on the schedule.

**Tied/Drawn Games**
- Configurable per round type: draws allowed or not.
- If draws are disabled, score entry requires a winner.
- If draws are enabled, tied scores are accepted and points awarded per the configured system.

### 4.8 Mid-Tournament Team Changes

- Organizer can add or remove teams after a tournament has started.
- **No automatic forfeit generation.** Organizer manually handles missed games (mark as forfeit, reschedule, etc.).
- Standings recalculate after any game status changes.

### 4.9 Points System

Configurable per event. Organizer sets point values for:

| Result | Default | Configurable |
|--------|---------|-------------|
| Win | 2 | Yes |
| Draw | 1 | Yes |
| Loss | 0 | Yes |

Points are used in standings calculations for Round Robin and Swiss rounds.

### 4.10 Standings

- Calculated in real-time based on submitted results, configured tiebreakers, and points system.
- Displayed per pool (Round Robin) or overall (Swiss).
- Columns: Rank, Team, W, L, D (if draws enabled), PTS, PD (point differential).
- Live-updating via WebSocket.

### 4.11 Bracket Visualization

- Interactive bracket component using an existing React bracket library.
- Shows: matchup, score (if played), time/location (if scheduled), consolation match.
- Responsive -- scrollable/zoomable on mobile.
- Double elimination shows both winners and losers bracket, plus grand final (and reset match if configured).

### 4.12 Team Management

- **Manual only.** Organizer adds, edits, and removes teams directly.
- Team data: team name, captain name, captain email, roster (list of player names).
- Assign teams to categories.
- No self-service registration in MVP.
- Each game has a match type: Singles or Doubles.

### 4.13 Real-Time Updates (WebSocket)

| Event | Payload | Consumers |
|-------|---------|-----------|
| `score:updated` | Game ID, scores, updated standings | All viewers of the event |
| `schedule:updated` | Changed game(s) with new time/location | All viewers |
| `bracket:advanced` | Updated bracket state | All viewers |
| `event:updated` | Event metadata changes | All viewers |
| `team:updated` | Team added/removed/modified | All viewers |

**Implementation:**
- Socket.IO server as a sidecar process alongside the Next.js app.
- Rooms scoped by event ID. Clients join a room when they open an event page.
- Single-server Socket.IO instance for MVP. Redis adapter is a post-MVP scaling concern.
- The Next.js API layer emits events to Socket.IO after mutations.

### 4.14 Event Sharing

- Every event gets an auto-generated URL slug from the event name (e.g., `yourdomain.com/events/summer-volleyball-classic-2026`).
- Slug uniqueness enforced (append number if collision: `-2`, `-3`, etc.).
- Auto-generated QR code (SVG, generated on the fly).
- Organizer can copy link or download QR image for printing.

### 4.15 Custom Banner / Branding

- Organizer uploads a banner image for their event.
- Displayed at the top of the public event page.
- Image: recommend 1200x400px, max 5MB, JPEG/PNG/WebP.
- Stored in S3-compatible object storage, served via CDN.

### 4.16 Landing Page

- Simple marketing landing page at the root URL.
- Structure: hero section with tagline + CTA, feature highlights (3-5 cards), signup/login CTA.
- No testimonials or complex content for MVP.
- Links to login/signup.

---

## 5. Coach Scheduler

A standalone module within RacketRulers. No connection to tournament features.

### 5.1 Overview

Coaches create an account on RacketRulers and set their weekly recurring availability. They get a shareable booking link. Parents and players visit the link and book available time slots without needing an account.

### 5.2 Coach Flow (Authenticated)

- Coach signs up / logs in to RacketRulers.
- Sets weekly recurring availability (e.g., Monday 9am-12pm, Wednesday 2pm-6pm).
- Configures session duration (default: 1 hour).
- Gets a shareable public booking link (e.g., `yourdomain.com/coach/{username}`).
- Views upcoming bookings in a calendar/list view.
- Can cancel a booking (booker is not notified in MVP -- no email service).

### 5.3 Booker Flow (No Account Required)

- Visits the coach's booking link.
- Sees available time slots for the upcoming weeks (based on coach's recurring availability minus already-booked slots).
- Selects a slot and submits: name, email, optional message.
- Receives a confirmation page with booking details.

### 5.4 Scope Boundaries (MVP)

- Weekly recurring availability only (no one-off date overrides).
- Fixed session duration (one duration per coach, not per slot).
- No email notifications or reminders.
- No payment processing.
- No buffer time between sessions (post-MVP).
- No intake forms beyond name + email + optional message.
- No recurring bookings (each booking is one-off).

---

## 6. Data Model

### 6.1 Entity Relationship Diagram

```
User
  |-- owns many Events
  |-- has CoachProfile (optional, for coach scheduler)

Event
  |-- has many Categories
  |-- has many Locations
  |-- has many Teams
  |-- has owner_id (User)
  |-- has banner_url (nullable)
  |-- has slug (unique)
  |-- has status: published | completed
  |-- has deleted_at (nullable, soft-delete)
  |-- has timezone (string, e.g., "America/Toronto")
  |-- has points_config (JSON)
  |-- has scoring_config (JSON)

Category
  |-- belongs to Event
  |-- has many Rounds (ordered)
  |-- has tiebreaker_config (JSON)
  |-- has draws_allowed (boolean, per round type override)

Round
  |-- belongs to Category
  |-- has type: round_robin | swiss | single_elim | double_elim | custom
  |-- has many Pools (if round_robin)
  |-- has many Games
  |-- has advancement_rules (JSON)
  |-- has config (JSON -- e.g., consolation_match, reset_match flags)
  |-- has draws_allowed (boolean)
  |-- has order (integer, position within category)

Pool
  |-- belongs to Round
  |-- has many PoolTeams (with seed)
  |-- has many Games

Game
  |-- belongs to Round (and optionally Pool)
  |-- has two GameTeams (team1/team2, nullable for TBD bracket games)
  |-- has location_id (nullable)
  |-- has scheduled_at (nullable datetime)
  |-- has duration_minutes (integer)
  |-- has status: scheduled | in_progress | completed | forfeit | cancelled
  |-- has score_team1 (integer, nullable)
  |-- has score_team2 (integer, nullable)
  |-- has match_type: singles | doubles
  |-- has set_scores (JSON, nullable)
  |-- has round_position (for bracket ordering)
  |-- has feeder_game_1_id (nullable, for bracket dependencies)
  |-- has feeder_game_2_id (nullable, for bracket dependencies)

Team
  |-- belongs to Event
  |-- has many CategoryTeams (with seed per category)
  |-- has name, captain_name, captain_email
  |-- has roster (JSON array of player names)

Location
  |-- belongs to Event
  |-- has name (string, e.g., "Court 1")

--- Coach Scheduler Entities ---

CoachProfile
  |-- belongs to User (one-to-one)
  |-- has display_name
  |-- has slug (unique, for booking URL)
  |-- has session_duration_minutes (default 60)
  |-- has timezone (string)

CoachAvailability
  |-- belongs to CoachProfile
  |-- has day_of_week (0-6, Monday=0)
  |-- has start_time (time, e.g., "09:00")
  |-- has end_time (time, e.g., "12:00")

Booking
  |-- belongs to CoachProfile
  |-- has date (date)
  |-- has start_time (time)
  |-- has end_time (time)
  |-- has booker_name (string)
  |-- has booker_email (string)
  |-- has message (text, nullable)
  |-- has status: confirmed | cancelled
  |-- has created_at
```

### 6.2 Key Schema Decisions

**Set-Based Scoring:**

Scores are stored as a `set_scores` JSON column containing an array of per-set scores (e.g., `[{ team1: 21, team2: 18 }, { team1: 15, team2: 21 }, { team1: 21, team2: 19 }]`). The `score_team1` and `score_team2` integer columns now represent sets won (e.g., 2 and 1) and are used for standings calculations. This approach keeps standings queries simple while supporting full set-level detail.

**Points Config (JSON on Event):**
```json
{ "win": 3, "draw": 1, "loss": 0 }
```

**Tiebreaker Config (JSON on Category):**
```json
{ "order": ["win_loss", "head_to_head", "point_differential", "points_scored"] }
```

**Advancement Rules (JSON on Round):**
```json
{
  "source_round_id": "uuid",
  "rules": [
    { "from_pool": 1, "positions": [1, 2], "to_seed": [1, 4] },
    { "from_pool": 2, "positions": [1, 2], "to_seed": [2, 3] }
  ]
}
```

**Round Config (JSON on Round):**
```json
// Single elimination with consolation match
{ "consolation_match": true }

// Double elimination with reset match
{ "reset_match": true }
```

**Roster (JSON on Team):**
```json
["Alice Johnson", "Bob Smith", "Carol Williams"]
```

**Feeder Games (foreign keys on Game):**

Instead of a JSON array of feeder game IDs, use two nullable foreign key columns (`feeder_game_1_id`, `feeder_game_2_id`). A bracket game has at most two feeder games. This enables proper referential integrity and simpler queries.

### 6.3 Indexes

- `Event.slug` -- unique index for URL lookups.
- `Event.owner_id` -- for listing a user's events.
- `Event.deleted_at` -- partial index (WHERE deleted_at IS NULL) for active event queries.
- `Game.round_id` + `Game.status` -- composite index for standings calculations.
- `CoachProfile.slug` -- unique index for booking URL lookups.
- `Booking.coach_profile_id` + `Booking.date` -- composite index for availability checks.

---

## 7. API Design

### 7.1 tRPC Router Structure

```
trpc/
  |-- auth.ts            profile, session
  |-- events.ts          CRUD, settings, publish, complete, soft-delete
  |-- categories.ts      CRUD, tiebreaker config, draws config
  |-- rounds.ts          CRUD, format config, advancement, round config
  |-- teams.ts           CRUD, seeding, category assignment
  |-- games.ts           score entry/edit, status updates (forfeit, cancel), matchup generation
  |-- schedule.ts        update time/location, drag-and-drop updates
  |-- locations.ts       CRUD (simple named list)
  |-- coach.ts           profile CRUD, availability CRUD, booking list, cancel booking
  |-- bookings.ts        public: list available slots, create booking
```

### 7.2 Key Operations

| Operation | Input | Side Effects |
|-----------|-------|--------------|
| `events.create` | name, dates, timezone | Creates event, generates slug |
| `events.update` | eventId, name?, dates?, scoringConfig? | Updates event details and scoring configuration |
| `games.submitScore` | gameId, scoreTeam1, scoreTeam2 | Recalc standings, broadcast WebSocket |
| `games.editScore` | gameId, scoreTeam1, scoreTeam2 | Recalc standings, warn if advancement may be stale, broadcast |
| `games.setForfeit` | gameId, winningTeamId | Update game status, recalc standings, broadcast |
| `games.cancel` | gameId | Mark cancelled, recalc standings (exclude game), broadcast |
| `rounds.generateMatchups` | roundId | Creates Game records for the round (RR pairings, bracket structure, etc.) |
| `rounds.advance` | roundId | Seeds next round from current standings, creates Games. Manual trigger only. |
| `schedule.updateGame` | gameId, locationId, scheduledAt | Assign or move a game on the schedule grid |
| `teams.create` | eventId, teamData | Add team to event |
| `teams.delete` | teamId | Remove team (organizer handles consequences manually) |
| `events.complete` | eventId | Sets status to completed, editing disabled |
| `coach.updateAvailability` | slots[] | Set recurring weekly availability |
| `bookings.getAvailableSlots` | coachSlug, dateRange | Public: returns open time slots |
| `bookings.create` | coachSlug, date, startTime, bookerName, bookerEmail, message? | Public: creates booking |

### 7.3 Rate Limiting

Basic rate limiting on public-facing endpoints:
- Booking creation: 10 per minute per IP.
- Public page views: 100 per minute per IP.
- Admin API calls: 60 per minute per user.

Implemented via a simple in-memory rate limiter (tRPC middleware).

---

## 8. Score Editing & Standings

### 8.1 Simplified Approach (MVP)

When a score is edited:

```
1. Update the score on the game record.
2. Recalculate standings for the affected pool/round.
3. Check if the round has been advanced (i.e., a subsequent round has been seeded from this round's standings).
4. If advanced:
   a. Display a warning to the organizer: "Standings have changed. The advancement
      for [next round name] may be outdated. Re-advance to update bracket matchups."
   b. Do NOT automatically re-advance.
   c. Organizer can manually re-trigger advancement, which re-seeds the next round.
5. Broadcast standings update via WebSocket.
```

This avoids the complexity of recursive cascade logic. The organizer stays in control.

---

## 9. Frontend Architecture

### 9.1 Page Structure

```
/                              Landing page (marketing)
/login                         Auth (NextAuth)
/signup                        Auth (NextAuth)
/events/{slug}                 Public event page
  /schedule                    Full schedule view
  /standings                   Standings by category
  /bracket                     Bracket visualization
/coach/{slug}                  Public coach booking page
/dashboard                     User dashboard
  /events                      List of user's events
  /events/new                  Create event (minimal form)
  /events/{id}/manage          Event admin panel
    /teams                     Team management
    /categories                Category & format setup
    /schedule                  Schedule editor (drag-and-drop)
    /scores                    Score entry interface
    /settings                  Event settings, branding
  /coach                       Coach scheduler management
    /availability              Set weekly availability
    /bookings                  View/manage bookings
```

### 9.2 Key UI Components

| Component | Description |
|-----------|-------------|
| `BracketView` | Interactive bracket using a React bracket library. Zoomable, scrollable. Shows consolation match. Double elim shows both brackets + grand final. |
| `ScheduleGrid` | Time x Location grid with drag-and-drop game placement. Conflict highlighting. Day navigation for multi-day events. |
| `StandingsTable` | Live-updating table (WebSocket-driven). Shows W/L/D/PTS/PD. |
| `ScoreEntryModal` | Quick score input. Simple mode only (two number inputs). Large tap targets for mobile. |
| `FormatBuilder` | Multi-step configuration: add rounds, set type, configure advancement rules, consolation/reset match toggles. |
| `QRCodeCard` | Generates and displays QR code SVG for event sharing. |
| `StaleAdvancementBanner` | Warning banner shown when standings have changed after advancement. Includes button to re-advance. |
| `CoachAvailabilityEditor` | Weekly grid where coaches toggle available time blocks. |
| `BookingSlotPicker` | Public-facing slot selector for booking coaching sessions. |

### 9.3 State Management

- **Server state**: tRPC + TanStack Query. Handles caching, optimistic updates, background refetch.
- **Real-time state**: WebSocket events invalidate TanStack Query caches or directly update query data via `queryClient.setQueryData`.
- **UI state**: React `useState`/`useReducer` for local component state. No global store needed.

---

## 10. Infrastructure & Deployment

### 10.1 Architecture

```
Docker Compose (local dev & production)

  +-------------------+    +-------------------+
  |  Next.js App      |    |  Socket.IO Server |
  |  (tRPC API)       |    |  (WebSocket)      |
  |  Port 3000        |    |  Port 3001        |
  +--------+----------+    +--------+----------+
           |                        |
           +----------+-------------+
                      v
            +-------------------+
            |   PostgreSQL      |
            |   Port 5432       |
            +-------------------+

  S3-compatible storage -- banner images
```

### 10.2 Local Development

- Docker Compose with services: `app` (Next.js), `ws` (Socket.IO), `db` (PostgreSQL).
- Hot reload for Next.js and Socket.IO server.
- Seed script for development data.

### 10.3 Production Deployment (Deferred Details)

- VPS provider TBD.
- Docker Compose with Nginx reverse proxy + SSL (Let's Encrypt).
- CI/CD via GitHub Actions: build Docker images, deploy on push to `main`.
- Daily automated PostgreSQL backups to object storage (30-day retention).

### 10.4 Security

- All traffic over HTTPS (production).
- NextAuth handles session management and CSRF protection.
- tRPC middleware enforces ownership checks on every endpoint.
- Basic rate limiting on public endpoints.
- File uploads validated (type, size) before storage.
- SQL injection prevented by Prisma's parameterized queries.

---

## 11. Testing Strategy

### 11.1 Framework

| Type | Tool | Scope |
|------|------|-------|
| Unit | Vitest | Tournament engine logic (standings calc, tiebreakers, bracket advancement), utility functions |
| E2E | Playwright | Critical paths: event creation, score entry, bracket advancement, coach booking flow |

### 11.2 Priority Test Coverage

1. **Standings calculation** -- all tiebreaker combinations, edge cases (ties, forfeits, draws).
2. **Bracket advancement** -- single elim, double elim, consolation, reset match.
3. **Matchup generation** -- round robin pairings, bracket seeding with byes.
4. **Score editing** -- standings recalculate correctly, stale advancement warning triggers.
5. **E2E: Tournament flow** -- create event, add teams, configure format, enter scores, advance bracket.
6. **E2E: Coach booking** -- set availability, book a session, view booking.

### 11.3 Error Monitoring

Console logging for MVP. Structured logs with timestamps and request context. No external service.

---

## 12. MVP Milestones

| # | Milestone | Key Deliverables |
|---|-----------|-----------------|
| 1 | **Foundation** | Project setup (Next.js, Prisma, tRPC, NextAuth, Docker Compose), DB schema + migrations, auth flow (email/password), basic dashboard shell |
| 2 | **Event CRUD + Settings** | Create/edit/delete events (soft-delete), slug generation, banner upload, locations CRUD, points config, timezone |
| 3 | **Teams** | Manual team management with roster, category assignment, seeding |
| 4 | **Categories + Format Config** | Category CRUD, round composition UI (FormatBuilder), tiebreaker config, draws toggle, consolation/reset match config |
| 5 | **Tournament Engine** | Round Robin standings + matchup generation, Swiss standings, Single Elim bracket logic, Double Elim bracket logic, Custom Bracket, advancement between rounds, all tiebreaker calculations |
| 6 | **Schedule System** | Drag-and-drop schedule grid, manual game placement, conflict detection, multi-day support, per-game durations |
| 7 | **Score Entry + Real-Time** | Score entry UI (simple mode), forfeit/cancel, stale advancement warnings, Socket.IO server, all WebSocket events, live-updating standings/bracket |
| 8 | **Public Pages** | Event pages (CSR), bracket visualization (library), schedule view, standings view, QR code sharing |
| 9 | **Coach Scheduler** | Coach profile, availability editor, public booking page, booking management |
| 10 | **Landing Page + Polish** | Marketing landing page, responsive design pass, error handling, rate limiting, testing suite |
| 11 | **Deployment** | Docker Compose production setup, Nginx config, SSL, CI/CD pipeline, backup automation |

---

## 13. Post-MVP Roadmap

| Phase | Features |
|-------|----------|
| **Phase 2: Multi-Admin + Registration** | Multi-admin invite links, self-service team registration with approval flow, registration deadlines |
| **Phase 3: Automation** | Automatic cascade recalculation on score edits, dynamic game assignment (auto-assign bracket games to slots), schedule auto-generation (time/location assignment), auto-forfeit generation for mid-tournament team changes |
| **Phase 4: Scoring + UX** | Set-based scoring mode, SSR for public pages (SEO), dark mode, team schedule filter, event cloning/templates, data export (CSV/PDF), audit log for score edits |
| **Phase 5: Coach Scheduler v2** | Buffer time between sessions, date overrides (block specific days), email notifications/reminders, intake forms, multiple session types with different durations |
| **Phase 6: Discovery + Communication** | Public Explore page with search/filter, email notifications for tournaments, sponsor logos, game notes |
| **Phase 7: Monetization** | Per-event pricing (Stripe), payment collection for team registration, organizer billing dashboard |
| **Phase 8: Scale + Platform** | Redis for WebSocket horizontal scaling, offline score entry (PWA), event analytics, public API, mobile app, i18n, auto-pairing for Swiss rounds |

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| **Category** | A division within an event (e.g., Men's A, Women's Open). Each has its own format and standings. |
| **Round** | A phase of competition within a category (e.g., pool play, quarterfinals). Has a type (RR, Swiss, SE, DE, Custom). |
| **Pool** | A group of teams within a Round Robin round. |
| **Advancement** | The process of moving teams from one round to the next based on standings. Manually triggered by the organizer. |
| **Slug** | The URL-friendly identifier for an event or coach profile (e.g., `summer-volleyball-2026`). |
| **Forfeit** | A game result where one team is awarded a win without play. |
| **Coach Profile** | A coach's public page with availability and booking functionality. |
| **Booking** | A scheduled coaching session booked by a parent/player. |
