-- Rename events table to tournaments
-- Step 1: Drop foreign key constraints referencing events table
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_event_id_fkey";
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_event_id_fkey";
ALTER TABLE "locations" DROP CONSTRAINT IF EXISTS "locations_event_id_fkey";
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_owner_id_fkey";

-- Step 2: Drop indexes on events table
DROP INDEX IF EXISTS "events_slug_key";
DROP INDEX IF EXISTS "events_owner_id_idx";
DROP INDEX IF EXISTS "events_deleted_at_idx";

-- Step 3: Rename events table to tournaments
ALTER TABLE "events" RENAME TO "tournaments";

-- Step 4: Add new columns to tournaments (moved from categories)
ALTER TABLE "tournaments" ADD COLUMN "format" "round_type";
ALTER TABLE "tournaments" ADD COLUMN "draws_allowed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tournaments" ADD COLUMN "tiebreaker_config" JSONB NOT NULL DEFAULT '{"order": ["win_loss", "head_to_head", "point_differential", "points_scored"]}';

-- Step 5: Recreate indexes on tournaments table
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");
CREATE INDEX "tournaments_owner_id_idx" ON "tournaments"("owner_id");
CREATE INDEX "tournaments_deleted_at_idx" ON "tournaments"("deleted_at");

-- Step 6: Recreate foreign key for tournaments.owner_id -> users.id
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Add seed column to teams
ALTER TABLE "teams" ADD COLUMN "seed" INTEGER NOT NULL DEFAULT 0;

-- Step 8: Migrate seed data from category_teams to teams (take max seed per team)
UPDATE "teams" t SET "seed" = COALESCE(
  (SELECT MAX(ct."seed") FROM "category_teams" ct WHERE ct."team_id" = t."id"),
  0
);

-- Step 9: Update rounds table - add tournament_id, populate from categories, drop category_id
ALTER TABLE "rounds" DROP CONSTRAINT IF EXISTS "rounds_category_id_fkey";
ALTER TABLE "rounds" ADD COLUMN "tournament_id" TEXT;

-- Populate tournament_id from categories.event_id
UPDATE "rounds" r SET "tournament_id" = (
  SELECT c."event_id" FROM "categories" c WHERE c."id" = r."category_id"
);

-- Make tournament_id NOT NULL after population
ALTER TABLE "rounds" ALTER COLUMN "tournament_id" SET NOT NULL;

-- Add confirmed column if it doesn't exist
ALTER TABLE "rounds" ADD COLUMN IF NOT EXISTS "confirmed" BOOLEAN NOT NULL DEFAULT false;

-- Drop old category_id column
ALTER TABLE "rounds" DROP COLUMN "category_id";

-- Add foreign key for rounds.tournament_id -> tournaments.id
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 10: Rename teams.event_id to teams.tournament_id
ALTER TABLE "teams" RENAME COLUMN "event_id" TO "tournament_id";

-- Add foreign key for teams.tournament_id -> tournaments.id
ALTER TABLE "teams" ADD CONSTRAINT "teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 11: Rename locations.event_id to locations.tournament_id
ALTER TABLE "locations" RENAME COLUMN "event_id" TO "tournament_id";

-- Add foreign key for locations.tournament_id -> tournaments.id
ALTER TABLE "locations" ADD CONSTRAINT "locations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 12: Drop category_teams table
DROP TABLE IF EXISTS "category_teams";

-- Step 13: Drop categories table
DROP TABLE IF EXISTS "categories";
