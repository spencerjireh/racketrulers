-- Challonge-aligned rework migration
-- Renames: Team->Participant (teams table unchanged), Game->Match (games table unchanged)
-- Enum value renames, new Tournament columns, games restructure, drop rounds/pools

-- ─── Step 1: Rename enum values ──────────────────────────────────────────────

-- TournamentStatus (event_status): DRAFT->PENDING, PUBLISHED->UNDERWAY, COMPLETED->COMPLETE
ALTER TYPE "event_status" RENAME VALUE 'DRAFT' TO 'PENDING';
ALTER TYPE "event_status" RENAME VALUE 'PUBLISHED' TO 'UNDERWAY';
ALTER TYPE "event_status" RENAME VALUE 'COMPLETED' TO 'COMPLETE';

-- MatchStatus (game_status): SCHEDULED->PENDING, IN_PROGRESS->OPEN, COMPLETED->COMPLETE
-- Note: FORFEIT stays, CANCELLED stays in DB enum but is no longer used in Prisma
ALTER TYPE "game_status" RENAME VALUE 'SCHEDULED' TO 'PENDING';
ALTER TYPE "game_status" RENAME VALUE 'IN_PROGRESS' TO 'OPEN';
ALTER TYPE "game_status" RENAME VALUE 'COMPLETED' TO 'COMPLETE';

-- TournamentFormat (round_type): drop CUSTOM is not possible in PG, but it stays unused.
-- Enum stays: ROUND_ROBIN, SWISS, SINGLE_ELIM, DOUBLE_ELIM, CUSTOM

-- ─── Step 2: Add new columns to tournaments ───────────────────────────────────

ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'SINGLE_STAGE';
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "third_place_match" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "grand_finals_modifier" TEXT;
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "rank_by" TEXT NOT NULL DEFAULT 'MATCH_WINS';
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "hide_seeds" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "quick_advance" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "show_standings" BOOLEAN NOT NULL DEFAULT true;

-- Add scoring_config and schedule_config if they don't exist yet
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "scoring_config" JSONB NOT NULL DEFAULT '{"pointsPerSet": 21, "totalSets": 3, "deuceEnabled": true, "maxPoints": 30}';
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "schedule_config" JSONB NOT NULL DEFAULT '{"slotDuration": 30, "dayStartHour": 8, "dayEndHour": 20}';
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "banner_url" TEXT;

-- ─── Step 3: Add tournament_id and round columns to games ─────────────────────

ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "tournament_id" TEXT;
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "round" INTEGER;

-- ─── Step 4: Backfill tournament_id from games->rounds->tournaments ───────────

UPDATE "games" g
SET "tournament_id" = r."tournament_id"
FROM "rounds" r
WHERE g."round_id" = r."id"
  AND g."tournament_id" IS NULL;

-- Backfill round number from rounds.order
UPDATE "games" g
SET "round" = r."order" + 1
FROM "rounds" r
WHERE g."round_id" = r."id"
  AND g."round" IS NULL;

-- ─── Step 5: Make tournament_id NOT NULL ──────────────────────────────────────

-- First handle any orphaned games (shouldn't exist but be safe)
DELETE FROM "games" WHERE "tournament_id" IS NULL;
ALTER TABLE "games" ALTER COLUMN "tournament_id" SET NOT NULL;

-- ─── Step 6: Add FK for games.tournament_id ───────────────────────────────────

ALTER TABLE "games" ADD CONSTRAINT "games_tournament_id_fkey"
  FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Step 7: Rename columns in games table ────────────────────────────────────

-- Score columns
ALTER TABLE "games" RENAME COLUMN "score_team1" TO "score_participant1";
ALTER TABLE "games" RENAME COLUMN "score_team2" TO "score_participant2";

-- Participant FK columns
ALTER TABLE "games" RENAME COLUMN "team1_id" TO "participant1_id";
ALTER TABLE "games" RENAME COLUMN "team2_id" TO "participant2_id";

-- Feeder columns
ALTER TABLE "games" RENAME COLUMN "feeder_game_1_id" TO "feeder_match_1_id";
ALTER TABLE "games" RENAME COLUMN "feeder_game_2_id" TO "feeder_match_2_id";

-- ─── Step 8: Drop old FK constraints referencing the renamed columns ──────────

ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_team1_id_fkey";
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_team2_id_fkey";
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_round_id_fkey";
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_pool_id_fkey";
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_feeder_game_1_id_fkey";
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_feeder_game_2_id_fkey";

-- ─── Step 9: Recreate FK constraints with new column names ────────────────────

ALTER TABLE "games" ADD CONSTRAINT "games_participant1_id_fkey"
  FOREIGN KEY ("participant1_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "games" ADD CONSTRAINT "games_participant2_id_fkey"
  FOREIGN KEY ("participant2_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "games" ADD CONSTRAINT "games_feeder_match_1_id_fkey"
  FOREIGN KEY ("feeder_match_1_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "games" ADD CONSTRAINT "games_feeder_match_2_id_fkey"
  FOREIGN KEY ("feeder_match_2_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Step 10: Drop old index and add new one ──────────────────────────────────

DROP INDEX IF EXISTS "games_round_id_status_idx";
CREATE INDEX IF NOT EXISTS "games_tournament_id_status_idx" ON "games"("tournament_id", "status");

-- ─── Step 11: Drop round_id and pool_id from games ───────────────────────────

ALTER TABLE "games" DROP COLUMN IF EXISTS "round_id";
ALTER TABLE "games" DROP COLUMN IF EXISTS "pool_id";

-- ─── Step 12: Drop pool_teams, pools, rounds tables ──────────────────────────

DROP TABLE IF EXISTS "pool_teams";
DROP TABLE IF EXISTS "pools";
DROP TABLE IF EXISTS "rounds";

-- ─── Step 13: Add set_scores and match_type to games if missing ───────────────

ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "set_scores" JSONB;

-- match_type enum and column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_type') THEN
    CREATE TYPE "match_type" AS ENUM ('SINGLES', 'DOUBLES');
  END IF;
END$$;

ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "match_type" "match_type" NOT NULL DEFAULT 'SINGLES';

-- ─── Step 14: Add seed to teams if missing ───────────────────────────────────

ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "seed" INTEGER NOT NULL DEFAULT 0;
