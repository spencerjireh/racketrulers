-- DropForeignKey
ALTER TABLE "coach_profiles" DROP CONSTRAINT "coach_profiles_user_id_fkey";

-- DropIndex
DROP INDEX "coach_profiles_user_id_key";

-- AlterTable
ALTER TABLE "coach_profiles" DROP COLUMN "user_id";
