import { Card, CardContent } from "@/components/ui/card";

interface BookingConfirmationProps {
  coachName: string;
  date: string;
  startTime: string;
  bookerName: string;
}

export function BookingConfirmation({
  coachName,
  date,
  startTime,
  bookerName,
}: BookingConfirmationProps) {
  return (
    <Card>
      <CardContent className="py-8 text-center space-y-3">
        <h2 className="text-xl font-bold">Booking Confirmed</h2>
        <p className="text-sm text-muted-foreground">
          Your session with {coachName} has been booked.
        </p>
        <div className="text-sm space-y-1">
          <p>
            <span className="font-medium">Date:</span>{" "}
            {new Date(date).toLocaleDateString([], {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p>
            <span className="font-medium">Time:</span> {startTime}
          </p>
          <p>
            <span className="font-medium">Name:</span> {bookerName}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
