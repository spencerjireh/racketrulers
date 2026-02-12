"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const DRAFT_STEPS = [
  { label: "Details", segment: "details", number: 1 },
  { label: "Format", segment: "format", number: 2 },
  { label: "Teams", segment: "teams", number: 3 },
  { label: "Rounds", segment: "rounds", number: 4 },
  { label: "Schedule", segment: "schedule", number: 5 },
  { label: "Review", segment: "review", number: 6 },
];

const PUBLISHED_TABS = [
  { label: "Details", segment: "details" },
  { label: "Format", segment: "format" },
  { label: "Teams", segment: "teams" },
  { label: "Rounds", segment: "rounds" },
  { label: "Schedule", segment: "schedule" },
  { label: "Scores", segment: "scores" },
];

interface EventStepperProps {
  eventId: string;
  status: "DRAFT" | "PUBLISHED" | "COMPLETED";
}

export function EventStepper({ eventId, status }: EventStepperProps) {
  const pathname = usePathname();
  const isDraft = status === "DRAFT";
  const basePath = `/dashboard/events/${eventId}/manage`;
  const maxStepRef = useRef(0);

  if (isDraft) {
    const currentStepIndex = DRAFT_STEPS.findIndex((s) =>
      pathname.includes(`/manage/${s.segment}`)
    );

    // Track the highest step ever reached so clicking back keeps later steps accessible
    if (currentStepIndex > maxStepRef.current) {
      maxStepRef.current = currentStepIndex;
    }
    const highestReached = maxStepRef.current;

    return (
      <nav className="flex gap-1 border-b">
        {DRAFT_STEPS.map((step, index) => {
          const href = `${basePath}/${step.segment}`;
          const isActive = pathname.includes(`/manage/${step.segment}`);
          const isCompleted = index < highestReached && !isActive;
          const isAccessible = index <= highestReached;

          return (
            <Link
              key={step.segment}
              href={isAccessible ? href : "#"}
              onClick={(e) => {
                if (!isAccessible) e.preventDefault();
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : isCompleted
                    ? "border-transparent text-foreground hover:text-foreground cursor-pointer"
                    : "border-transparent text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : step.number}
              </span>
              {step.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  // Published/Completed mode: free navigation tabs
  return (
    <nav className="flex gap-1 border-b">
      {PUBLISHED_TABS.map((tab) => {
        const href = `${basePath}/${tab.segment}`;
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
