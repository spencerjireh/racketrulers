-- AlterTable
ALTER TABLE "coach_profiles" ADD COLUMN "user_id" TEXT UNIQUE;

-- AddForeignKey
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
