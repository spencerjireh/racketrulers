import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { COACH_SLUG } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = hashSync("password123", 12);

  await prisma.user.upsert({
    where: { email: "test@tourneyhub.com" },
    update: {},
    create: {
      name: "Test User",
      email: "test@tourneyhub.com",
      password: hashedPassword,
    },
  });

  // Seed the singleton coach profile
  const coach = await prisma.coachProfile.upsert({
    where: { slug: COACH_SLUG },
    update: {},
    create: {
      displayName: "Michael",
      slug: COACH_SLUG,
      sessionDurationMinutes: 60,
    },
  });

  // Seed default availability (Mon-Fri, 9:00-17:00)
  await prisma.$transaction([
    prisma.coachAvailability.deleteMany({ where: { coachProfileId: coach.id } }),
    prisma.coachAvailability.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        dayOfWeek: i,
        startTime: "09:00",
        endTime: "17:00",
        coachProfileId: coach.id,
      })),
    }),
  ]);

  console.log("Seed complete: test@tourneyhub.com / password123");
  console.log("Seed complete: Coach Michael with Mon-Fri 9:00-17:00 availability");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
