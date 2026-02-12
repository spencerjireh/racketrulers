"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/ui/loading-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, User, Calendar, BookOpen } from "lucide-react";
import { ProfileSetup } from "./profile-setup";
import { ProfileSettings } from "./profile-settings";
import { AvailabilityEditor } from "./availability-editor";
import { BookingsList } from "./bookings-list";

const SECTIONS = [
  { id: "profile", label: "Profile Settings", icon: User },
  { id: "availability", label: "Weekly Availability", icon: Calendar },
  { id: "bookings", label: "Bookings", icon: BookOpen },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function CoachDashboard() {
  const trpc = useTRPC();
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    () => new Set(SECTIONS.map((s) => s.id))
  );

  const { data: profile, isLoading } = useQuery(
    trpc.coach.getProfile.queryOptions()
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (!profile) {
    return <ProfileSetup />;
  }

  function toggleSection(id: SectionId) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map(({ id, label, icon: Icon }) => (
        <Collapsible
          key={id}
          open={openSections.has(id)}
          onOpenChange={() => toggleSection(id)}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-lg font-semibold">{label}</span>
                  </div>
                  {openSections.has(id) ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Separator />
              <CardContent className="pt-6">
                {id === "profile" && <ProfileSettings profile={profile} />}
                {id === "availability" && (
                  <AvailabilityEditor
                    initialSlots={profile.availability.map((a) => ({
                      dayOfWeek: a.dayOfWeek,
                      startTime: a.startTime,
                      endTime: a.endTime,
                    }))}
                  />
                )}
                {id === "bookings" && <BookingsList />}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}
