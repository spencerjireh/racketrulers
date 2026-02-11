import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

export async function verifyEventOwnership(
  prisma: PrismaClient,
  eventId: string,
  userId: string
) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId: userId, deletedAt: null },
  });
  if (!event) throw new TRPCError({ code: "NOT_FOUND" });
  return event;
}

export async function verifyCategoryOwnership(
  prisma: PrismaClient,
  categoryId: string,
  eventId: string,
  userId: string
) {
  const event = await verifyEventOwnership(prisma, eventId, userId);
  const category = await prisma.category.findFirst({
    where: { id: categoryId, eventId },
  });
  if (!category) throw new TRPCError({ code: "NOT_FOUND" });
  return { event, category };
}

export async function verifyRoundOwnership(
  prisma: PrismaClient,
  roundId: string,
  eventId: string,
  userId: string
) {
  const event = await verifyEventOwnership(prisma, eventId, userId);
  const round = await prisma.round.findFirst({
    where: { id: roundId, category: { eventId } },
    include: { category: true },
  });
  if (!round) throw new TRPCError({ code: "NOT_FOUND" });
  return { event, round };
}
