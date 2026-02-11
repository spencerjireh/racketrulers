import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export default function CoachPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coach Scheduler</h1>
          <p className="text-muted-foreground">
            Manage your coaching availability and bookings
          </p>
        </div>
        <Button>Set Up Profile</Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No coach profile yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Set up your coaching profile to start accepting bookings
          </p>
          <Button className="mt-4">Set Up Profile</Button>
        </CardContent>
      </Card>
    </div>
  );
}
