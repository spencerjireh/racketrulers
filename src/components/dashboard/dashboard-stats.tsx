"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Calendar, Users } from "lucide-react";

export function DashboardStats() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.tournaments.getStats.queryOptions());

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Tournaments</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data?.totalTournaments ?? 0}</div>
          <p className="text-xs text-muted-foreground">
            {data?.totalTournaments ? `${data.totalTournaments} tournament(s)` : "Create your first tournament"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active Tournaments</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data?.activeTournaments ?? 0}</div>
          <p className="text-xs text-muted-foreground">
            {data?.activeTournaments ? `${data.activeTournaments} active` : "No active tournaments"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Coaching Sessions</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">0</div>
          <p className="text-xs text-muted-foreground">No upcoming sessions</p>
        </CardContent>
      </Card>
    </div>
  );
}
