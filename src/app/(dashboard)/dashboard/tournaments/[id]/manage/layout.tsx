import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ManageTournamentLayout({
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = await prisma.tournament.findFirst({
    where: { id, deletedAt: null },
    select: { slug: true },
  });

  if (!tournament) {
    redirect("/dashboard/tournaments");
  }

  redirect(`/tournaments/${tournament.slug}`);
}
