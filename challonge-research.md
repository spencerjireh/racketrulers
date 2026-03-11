# Challonge User Flow Research

Research conducted on 2026-03-10 by navigating challonge.com with Playwright.
Updated on 2026-03-11: verified all sections against live Challonge site + compared against RacketRulers codebase.
Re-verified on 2026-03-11: created a test tournament end-to-end via Playwright MCP to audit every section. 95% accurate; corrections applied below.

---

## 1. High-Level Architecture

Challonge uses a **single-page-per-concern** pattern. Each tournament lives at a vanity URL (`challonge.com/{slug}`) and has sub-pages accessible via a **hamburger dropdown menu** (not a traditional tab bar). The current page's name is displayed as an accordion label; clicking the hamburger icon expands the full navigation.

| Page | URL Pattern | Purpose | Visibility |
|------|-------------|---------|------------|
| Bracket | `/{slug}` | Main tournament view with bracket visualization | Public |
| Participants | `/{slug}/participants` | Add/manage/seed participants | Admin only |
| Settings | `/{slug}/settings` | Edit tournament configuration | Admin only |
| Standings | `/{slug}/standings` | Rankings table | Public |
| Announcements | `/{slug}/announcements` | Tournament announcements feed | Public |
| Log | `/{slug}/log` | Activity feed (created, started, score updates) | Public |
| Stations | `/{slug}/stations` | Court/station management and auto-assignment | Admin only |
| Report Scores | `/{slug}/report_scores` | Alternative score reporting interface | Admin only (only visible after tournament started) |
| Issues | `/{slug}/issues` | Tournament issues tracker | Admin only |
| Fullscreen | `/{slug}/fullscreen` | Full-screen bracket view | Public (bracket button only, not in nav) |

Nav items with activity show counts in parentheses, e.g. "Announcements (0)", "Log (3)", "Issues (0)".

The **admin bar** at the top of the bracket page shows contextual guidance:
- Pre-participants: "add participants"
- Pre-start: "Start the Tournament" button
- Live: "Report scores below until the tournament is complete." (with progress bar)

---

## 2. Tournament Creation Flow

### Step 1: Create Tournament (single form page)

URL: `/tournaments/new`

Accessed via the dashboard "Create a Tournament" dropdown, which offers two options:
- **Tournament** (bracket)
- **Race**

The form is organized into collapsible sections:

#### Basic Info
- **Host**: dropdown (personal account or community), with promotion: "Host your tournament as a Community to centralize your tournaments, announcements, player stats, and more."
- **Tournament name** (required)
- **URL slug**: auto-generated, editable (`challonge.com/{slug}`)
- **Description**: rich text editor (bold, italic, strikethrough, unordered list, ordered list, link, insert image, align left/center/right/justify, horizontal rule, remove format, view HTML)

#### Game Info
- **Game** (required): autocomplete search field with placeholder "The game or sport being played"
- **Rankings impacted**: shows "none" with note about hosting as community to unlock ratings
- **Type**: radio buttons
  - Single Stage Tournament (default)
  - Two Stage Tournament -- groups compete separately, winners proceed to a final stage (e.g. World Cup)
- **Format**: dropdown
  - Single Elimination
  - Double Elimination
  - Round Robin
  - Swiss
  - Free For All
  - Leaderboard
- Format-specific option: "Break ties with placement matches" checkbox

#### Registration
- **Registration mode**: radio buttons
  - "Provide a list of participants" (default) -- admin adds them manually
  - "Host a sign-up page" -- allows custom questions to participants
- **Registration fee**: Free / Paid (paid only available with sign-up page, uses Stripe)
- **Participants**:
  - "Require participants to register as a team" checkbox (with note about team captains)
  - "Specify a maximum number of participants" checkbox
- **Start Time** (required): date picker + time picker
  - "Mark as tentative" checkbox
  - Timezone note linking to account settings
  - "Require participants to check in" checkbox (disabled until start time set)

#### Predictions and Voting
- Enable voting for open matches (voters must register for Challonge)
- Enable bracket predictions

#### Experimental Features (with Challonge Labs badge)
- Generate shareable images for match results (SE, DE, RR, Swiss only)
- Require participants to have verified emails (open registration only)
- Allow specific countries for registration (region locking)
- Allow custom fields in Predictions (requires predictions activated)
- Disclaimer: "Experimental features are subject to change. Additionally, in the future these features might only be available to those with a Challonge Premier subscription."

#### Advanced Options (collapsed by default, 4 sub-tabs on creation; 5 sub-tabs post-creation)

**Bracket tab:**
- Show customizable round labels (checked by default)
- Hide the seed numbers
- Hide the bracket preview from the public
- Quick advance -- report winners only, not scores
- Allow match attachments
- Seeding method: "Traditional Seeding Rules" / "The Order of the Participants List" (with "how they differ" link)

**Permissions tab:**
- Allow participants with Challonge accounts to report their own scores (checked by default)
- Share admin access to this tournament (select to specify usernames)
- Exclude this event from search engines and the public browsable index

**Notifications tab:**
- Notify users when their matches become available (checked by default)
- Send out the final results when this event ends (checked by default)

**Misc tab:**
- Show announcements tab (checked by default)
- Show standings tab (checked by default)

#### Submit
Single button: **"Save and Continue"**

### Step 2: Redirect to Tournament Page

After creation, user lands on `/{slug}` with the admin bar saying:
> "Hey, {username}! Your next step as an admin will always show up here. To get started, add participants."

---

## 3. Participant Management Flow

URL: `/{slug}/participants`

### Add Methods
1. **Individual**: "+ Add Participant" button
2. **Bulk Add**: modal with textarea, one per line
   - Formats supported:
     - `Display Name` (name only)
     - `Display Name, ChallongeUsername` (name + link to account)
     - `Display Name, email@domain.com` (name + email invite)
     - `, email@domain.com` (email only)

### Participant List
Table with columns:
- **Seed** (editable number button)
- **Participant name**
- Action buttons per row (edit, something, delete -- 3 icon buttons)

### Tools
- **Shuffle Seeds** button (disabled when 0 participants)
- **Bulk Add** button
- Drag and drop to reorder seeds on the bracket preview page

---

## 4. Tournament Lifecycle

### States

```
Created -> Participants Added -> Started (Live) -> Completed
```

### Pre-Start (Bracket Preview)
- Bracket is shown as a preview with note: "This bracket is a preview and subject to change until the tournament is started."
- Admin can drag and drop participants to swap bracket positions
- Admin bar shows: **"Start the Tournament"** button

### Live (In Progress)
- Admin bar shows: "Report scores below until the tournament is complete." (with a progress bar)
- Each match on the bracket has a clickable pencil/edit icon
- Bracket shows round labels at the **top** of the bracket (e.g. "Round 1", "Semifinals", "Finals")
- Status badge shows "LIVE" (red dot + text) in the top-right of the bracket area
- Bracket controls in top-right: fullscreen icon, SVG download icon, embed icon

### Score Reporting (Inline Panel)
Clicking a match opens an **inline panel adjacent to the bracket** (not a slide-out from the edge) with two tabs:

#### Tab 1: Report Scores (shown by default)
- **"Add a set"** button for multi-set scoring
- Table with:
  - Participant column
  - Score column (number spinbutton per participant per set)
- **"Verify the winner"** section: clickable player name buttons to confirm winner
- **"Submit scores"** button
- If no winner is selected, a confirmation dialog appears: "Before you continue -- No winner is selected but you can still save it as-is" with Submit/Cancel buttons

#### Tab 2: Match Details
- Player A vs Player B (with avatars)
- Current score display (shows "-" for unplayed matches)
- **"Set station and time"** button (assign match to a court/location + time)

### Completed
- Winners shown with checkmarks on bracket
- Final standings available

---

## 5. Tournament Settings (Post-Creation)

URL: `/{slug}/settings`

Same form as creation but with some fields **disabled after start**:
- Type (single/two stage): disabled
- Format dropdown: disabled
- Split Participants checkbox: disabled
- Break ties with placement matches: disabled
- Participants play each other: disabled
- Number of rounds: disabled
- Bracket predictions: disabled (shows "Winners bracket only" note)

Save button changes from "Save and Continue" to **"Save Changes"**.

The Registration section is **not shown** on the settings page after the tournament has started.

#### Reset or Delete (Advanced Options tab, post-creation only)
- **Reset the Bracket**: "If you need to add or reorder participants, you can reset your bracket to take a step back. This is a destructive operation that will **clear all scores and attachments**, so be careful!" with a "Reset" link
- **Delete Tournament**: "Deleting this tournament will remove all traces of it, and there's no undo." with a "Delete" link (triggers browser confirm dialog)

### Additional settings visible post-creation:

#### Ranking/Scoring Configuration (visible for all formats)
- **Rank by** dropdown:
  - Match Wins (default)
  - Game/Set Wins
  - Game/Set Win %
  - Game/Set W/L Difference
  - Points Scored
  - Points Difference
  - Custom (points system)
- **Points configuration** (always visible, values used when Custom selected):
  - Points per match win (default: 1.0)
  - Points per match tie (default: 0.5)
  - Points per game/set win (default: 0.0)
  - Points per game/set tie (default: 0.0)
  - Points per bye (default: 1.0)

#### Double Elimination specific:
- **Grand Finals** options:
  - 1-2 matches -- winners bracket finalist has to be defeated twice by the losers bracket finalist (default)
  - 1 match
  - None
- **Split Participants**: start half in losers bracket (with "Learn More" link)
- **Participants play each other**: once / twice / 3 times

#### Free For All specific:
- **Participants per match** (spinbutton)

#### Swiss specific:
- **Number of rounds** (spinbutton)

---

## 6. Public Tournament View

URL: `/{slug}` (no auth required)

### Header
- Tournament name (with share icon button)
- Hamburger dropdown navigation: current page name displayed, expands to show all pages
- Metadata bar:
  - Players count
  - Format
  - Game (linked to game search page)
  - Start Time (formatted with timezone)
  - Organized by (linked to user profile)

### Bracket View
- SVG-based bracket visualization
- Rounds labeled at the **top** of the bracket area (Round 1, Semifinals, Finals)
- Each match shows:
  - Match number (left side)
  - Two participants with seed numbers
  - Winner indicated with checkmark
  - Scores displayed next to participant names
- Controls (top-right, next to LIVE badge):
  - Fullscreen icon (links to `/{slug}/fullscreen`)
  - Download SVG icon (links to `/{slug}.svg`)
  - Embed icon

### Standings Table (Single/Double Elimination)
Separate page at `/{slug}/standings`. Columns:
- Rank
- Participant Name
- Challonge User
- Match History

### Standings Table (Round Robin)
Shown below the bracket. Columns:
- Rank
- Team
- Played
- Remaining
- 1. Pts (primary ranking metric)
- 2. TB (tiebreaker)
- 3. Pts Diff (points difference)
- 4. Match W-L-T

---

## 7. Stations Page

URL: `/{slug}/stations`

Dedicated page for managing courts/stations (admin only). Features:

### Options
- **Automatically assign stations to matches** as they become available
- **Require matches to have assigned stations** before starting them and sending notifications
- Save button

Links to knowledge base article on creating and assigning stations.

---

## 8. Dashboard

URL: `/dashboard`

- **"Your tournaments"** heading
- **"Create a Tournament"** dropdown button:
  - Tournament (bracket)
  - Race
- **Status filter tabs**: All, Pending, In Progress, Complete (with count badges) -- *Note: not observed during re-verification (tournament list stuck loading); may require tournaments to exist or may have been removed*
- **Search bar**: "Search your tournaments" text input
- **Search Tournaments** dropdown with additional options: Search Tournaments, Search Events, Search Communities, Discover Communities
- Tournament list: each item shows host avatar, tournament name, format, game, participant count
- Footer: links to About, Pricing, Knowledge Base, Contact, Partners, Organized Play, API, Bracket Generator

---

## 9. Key Design Patterns

### Navigation Model
- **Hamburger dropdown** within a tournament (not a traditional tab bar)
- Current page name shown as accordion label; clicking hamburger icon reveals all pages
- Each sub-page is a separate URL
- Admin-only pages (Participants, Settings, Stations, Report Scores, Issues) only shown to the tournament owner
- The admin guidance bar at the top is contextual and guides the user through the lifecycle

### Tournament URL Structure
- Vanity slug: `challonge.com/{slug}`
- Sub-pages: `/{slug}/participants`, `/{slug}/settings`, `/{slug}/standings`, `/{slug}/announcements`, `/{slug}/log`, `/{slug}/stations`, `/{slug}/report_scores`, `/{slug}/issues`, `/{slug}/fullscreen`

### Score Reporting UX
- Click directly on a match in the bracket to open inline score panel
- Set-based scoring (can add multiple sets via "Add a set")
- Must verify/confirm the winner explicitly before submitting (confirmation dialog warns if no winner selected)
- Submit updates the bracket in real-time

### Bracket Visualization
- SVG-based rendering
- Horizontal bracket layout (standard tournament tree)
- Matches flow left-to-right for elimination brackets
- Round robin shows all matches in a grid-like layout organized by round
- Round labels shown at top of bracket area
- Fullscreen mode available
- SVG download available

### Seeding
- Traditional seeding rules (1v8, 2v7, etc.) or participant list order
- Shuffle seeds button
- Drag and drop reordering on bracket preview (before start)
- Seed numbers shown on bracket (can be hidden)

---

## 10. Feature Comparison: Challonge vs RacketRulers Current

| Feature | Challonge | RacketRulers |
|---------|-----------|--------------|
| Tournament creation | Single page form with collapsible sections | Single page form (name, description, format, dates, timezone) |
| Formats | SE, DE, RR, Swiss, FFA, Leaderboard | SE, DE, RR, Swiss |
| Two-stage tournaments | Yes (group -> finals) | No (single stage only) |
| Participant management | Dedicated /participants page with bulk add formats | Dedicated /participants page with bulk add (name only) |
| Bulk add formats | Name, Name+Username, Name+Email, Email only | Name only (one per line) |
| Self-registration | Sign-up page with custom questions + paid registration | No |
| Score reporting | Click match on bracket, inline panel with 2 tabs | Click match on bracket, right-side Sheet panel |
| Score entry model | "Add a set" button, manual set count, verify winner | Fixed set grid based on scoring config, auto-decided |
| Bracket visualization | SVG-based, horizontal tree | Custom SVG connectors + match cards, horizontal tree |
| Bracket zoom | Not observed | Yes (0.5x, 0.75x, 1.0x with +/- controls) |
| Standings | Inline below bracket (RR) or separate /standings page | Separate /standings page with configurable tiebreakers |
| Standings columns (RR) | Rank, Team, Played, Remaining, Pts, TB, Pts Diff, W-L-T | Rank, Name, GP, W, D, L, PF, PA, PD, Pts |
| Activity log | /log page (created, started, score updates with timestamps) | No |
| Announcements | /announcements page | No |
| Stations/Courts | /stations page with auto-assign + requirement options | Locations manager in settings + drag-and-drop schedule |
| Vanity URLs | Yes (challonge.com/{slug}) | Yes (/tournaments/{slug}) |
| Admin guidance bar | Contextual lifecycle prompts with progress bar | Contextual lifecycle prompts (add participants, start, report scores, view standings) |
| Match station/time | "Set station and time" per match in score panel | Drag-and-drop schedule calendar with auto-scheduling |
| Auto-scheduling | Auto-assign stations to matches | Full auto-schedule dialog (duration, breaks, day hours, courts) |
| Ranking config | Match Wins, Game/Set Wins, Points, Custom | Configurable tiebreaker priority order |
| Points config | Win/Tie/Set Win/Set Tie/Bye points | Win/Draw/Loss points + per-set scoring rules |
| Rich description | Full WYSIWYG editor | Plain textarea |
| Bracket predictions | Yes | No |
| Match voting | Yes | No |
| Embed/export | SVG download, fullscreen, embed code | No |
| Realtime updates | Not clearly observed (likely polling) | Soketi/Pusher websockets (instant updates) |
| Navigation model | Hamburger dropdown per tournament | Tab bar with underline indicator |
| Game type | Any game/sport | Badminton-focused |
| Scoring rules | Generic set scoring, verify winner | Badminton-specific: points per set, deuce rules, max cap |
| Forfeit handling | Not observed | Explicit forfeit buttons per team, FORFEIT status |
| Cascade warnings | Not observed | Warning dialog when score changes affect downstream matches |
| Coach scheduling | No | Full coach booking system (availability, calendar, public booking) |
| Drag-and-drop seeding | Yes (bracket preview) | Yes (seed list with debounced persistence) |
| Shuffle seeds | Yes | Yes |
| Tournament search | Game-based search + public index | Search by name + status filter |
| Dashboard filters | All, Pending, In Progress, Complete tabs | Grid of tournament cards with status badges |
| Team registration | "Require participants to register as a team" | Captain name/email + roster textarea |
| Issues tracking | /issues page | No |
| Report Scores page | Dedicated /report_scores page | No (score entry via bracket clicks only) |
| Permission sharing | Share admin access by username | No |
| Private tournaments | Exclude from search engines/public index | PENDING status = private (visible to owner only) |

---

## 11. Key Takeaways for RacketRulers Rework

### Already implemented (parity with Challonge):
1. Single-page tournament creation form
2. Lifecycle-driven admin bar (add participants -> start -> report scores -> view standings)
3. Click-on-bracket score reporting (right-side Sheet panel)
4. Bracket preview with drag-and-drop seeding + shuffle seeds
5. Tab-based tournament pages (Bracket, Participants, Standings, Settings)
6. Vanity slug URLs
7. Bulk participant add
8. Set-based scoring
9. Configurable ranking/tiebreakers
10. Real-time updates (we have websockets, they likely use polling)
11. Court/station management (we have drag-and-drop schedule calendar)
12. Forfeit handling
13. Cascade warnings for downstream matches

### Challonge features we lack:
1. **Activity log** -- history of tournament events with timestamps
2. **Announcements page** -- admin-posted messages to participants
3. **Rich text description** -- WYSIWYG editor for tournament descriptions
4. **Bracket predictions** -- users predict bracket outcomes
5. **Match voting** -- community voting on open matches
6. **SVG export / embed** -- download bracket as SVG, embed code, fullscreen mode
7. **Self-registration** -- sign-up page with custom questions + paid registration (Stripe)
8. **Permission sharing** -- share admin access to other users by username
9. **Quick advance** -- report winners only without scores
10. **Two-stage tournaments** -- group stage -> finals stage (World Cup style)
11. **Issues tracker** -- report and track tournament issues
12. **Dedicated report scores page** -- alternative to clicking on bracket
13. **Region locking** -- restrict registration by country
14. **Match attachments** -- file uploads per match

### RacketRulers advantages over Challonge:
1. **Badminton-specific scoring** -- deuce rules, point caps, configurable set format
2. **Real-time websockets** -- instant score/bracket updates vs. Challonge's apparent polling
3. **Full auto-scheduling** -- duration, breaks, day hours, court constraints
4. **Drag-and-drop schedule calendar** -- visual match-to-court/time assignment
5. **Coach booking system** -- availability management + public booking (unique feature)
6. **Bracket zoom controls** -- adjustable zoom levels for large brackets
7. **Tiebreaker priority ordering** -- user-defined ordering (not Challonge's fixed rules)
8. **Cascade warning dialogs** -- warns when score changes affect downstream matches
9. **Forfeit UX** -- explicit forfeit buttons per team

### Specific UX patterns worth adopting from Challonge:
- **WYSIWYG description editor** -- replace plain textarea
- **Activity log** -- show tournament event timeline
- **SVG export + fullscreen** -- bracket sharing/printing
- **Winner verification** -- explicit "verify the winner" step before score submission
- **"Add a set" dynamic scoring** -- let users add sets on demand (vs. fixed grid)
- **Match station/time in score panel** -- "Set station and time" button on each match
- **Progress bar on admin bar** -- visual indicator of tournament completion
- **Announcements** -- admin-to-participant communication channel
