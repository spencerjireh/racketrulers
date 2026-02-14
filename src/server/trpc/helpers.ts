import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

export async function verifyTournamentOwnership(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string
) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, ownerId: userId, deletedAt: null },
  });
  if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
  return tournament;
}

export async function verifyRoundOwnership(
  prisma: PrismaClient,
  roundId: string,
  tournamentId: string,
  userId: string
) {
  const tournament = await verifyTournamentOwnership(prisma, tournamentId, userId);
  const round = await prisma.round.findFirst({
    where: { id: roundId, tournamentId },
  });
  if (!round) throw new TRPCError({ code: "NOT_FOUND" });
  return { tournament, round };
}
