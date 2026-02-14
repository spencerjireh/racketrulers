import { redirect } from "next/navigation";
import { createServerCaller } from "@/lib/trpc/server";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Settings", segment: "settings" },
  { label: "Participants", segment: "participants" },
  { label: "Bracket", segment: "bracket" },
] as const;

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
      <nav className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.segment}
            href={`/dashboard/tournaments/${id}/manage/${tab.segment}`}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 border-transparent",
              "hover:text-foreground hover:border-muted-foreground/30",
              "transition-colors -mb-px"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
