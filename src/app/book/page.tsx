import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function BookPage() {
  const coach = await prisma.coachProfile.findFirst({ select: { slug: true } });
  if (!coach) redirect("/");
  redirect(`/book/${coach.slug}`);
}
