"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/ui/loading-state";
import { ProfileSetup } from "./profile-setup";
import { ProfileSettings } from "./profile-settings";
import { AvailabilityEditor } from "./availability-editor";
import { BookingsList } from "./bookings-list";

export function CoachDashboard() {
  const trpc = useTRPC();

  const { data: profile, isLoading } = useQuery(
    trpc.coach.getProfile.queryOptions()
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (!profile) {
    return <ProfileSetup />;
  }

  return (
    <div className="space-y-6">
      <ProfileSettings profile={profile} />
      <AvailabilityEditor
        initialSlots={profile.availability.map((a) => ({
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
        }))}
      />
      <BookingsList />
    </div>
  );
}
