"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Settings", segment: "settings" },
  { label: "Participants", segment: "participants" },
  { label: "Bracket", segment: "bracket" },
] as const;

export function ManageTabs({ tournamentId }: { tournamentId: string }) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.segment}
          href={`/dashboard/tournaments/${tournamentId}/manage/${tab.segment}`}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            segment === tab.segment
              ? "border-primary text-foreground"
              : "border-transparent hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
