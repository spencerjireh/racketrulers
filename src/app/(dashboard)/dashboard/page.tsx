import { getRequiredSession } from "@/lib/auth-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getRequiredSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {session?.user?.name ?? "there"}
        </h1>
        <p className="text-muted-foreground">
          Manage your tournaments and coaching sessions
        </p>
      </div>

      <DashboardStats />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild>
              <Link href="/dashboard/tournaments">My Tournaments</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/coach">Coach Scheduler</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
