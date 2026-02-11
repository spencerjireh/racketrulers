import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

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

  console.log("Seed complete: test@tourneyhub.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
