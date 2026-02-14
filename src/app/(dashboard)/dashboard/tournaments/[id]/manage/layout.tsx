import { redirect } from "next/navigation";
import { createServerCaller } from "@/lib/trpc/server";
import { Badge } from "@/components/ui/badge";
import { ManageTabs } from "@/components/dashboard/manage-tabs";

export default async function ManageTournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caller = await createServerCaller();

  let tournament;
  try {
    tournament = await caller.tournaments.getById({ id });
  } catch {
    redirect("/dashboard/tournaments");
  }

  const statusLabel =
    tournament.status === "DRAFT"
      ? "Draft"
      : tournament.status === "PUBLISHED"
        ? "Active"
        : "Completed";

  const statusVariant =
    tournament.status === "DRAFT"
      ? "outline"
      : tournament.status === "PUBLISHED"
        ? "default"
        : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <Badge variant={statusVariant as "default" | "secondary" | "outline"}>
          {statusLabel}
        </Badge>
      </div>
      <ManageTabs tournamentId={id} />
      {children}
    </div>
  );
}
