"use client";

import { CoachDashboard } from "@/components/coach/coach-dashboard";

export default function CoachPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coach Scheduler</h1>
        <p className="text-muted-foreground">
          Manage your coaching availability and bookings
        </p>
      </div>
      <CoachDashboard />
    </div>
  );
}
