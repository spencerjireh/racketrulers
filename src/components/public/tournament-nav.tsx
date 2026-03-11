"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface TournamentNavProps {
  slug: string;
  isOwner?: boolean;
}

export function TournamentNav({ slug, isOwner }: TournamentNavProps) {
  const pathname = usePathname();

  const tabs = [
    { label: "Bracket", segment: "bracket" },
    { label: "Participants", segment: "participants" },
    { label: "Standings", segment: "standings" },
    ...(isOwner ? [{ label: "Settings", segment: "settings" }] : []),
  ];

  return (
    <nav className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const href = `/tournaments/${slug}/${tab.segment}`;
        const isActive = pathname === `/tournaments/${slug}/${tab.segment}`;
        return (
          <Link
            key={tab.segment}
            href={href}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
