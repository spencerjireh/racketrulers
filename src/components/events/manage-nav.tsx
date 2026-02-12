"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Settings", segment: "settings" },
  { label: "Teams", segment: "teams" },
  { label: "Categories", segment: "categories" },
  { label: "Schedule", segment: "schedule" },
  { label: "Scores", segment: "scores" },
  { label: "Courts", segment: "locations" },
];

export function ManageNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const href = `/dashboard/events/${eventId}/manage/${tab.segment}`;
        const isActive = pathname.includes(`/manage/${tab.segment}`);
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
