"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";

interface TournamentAdminBarProps {
  status: "PENDING" | "UNDERWAY" | "COMPLETE";
  participantCount: number;
  slug: string;
  tournamentId: string;
}

export function TournamentAdminBar({
  status,
  participantCount: initialParticipantCount,
  slug,
  tournamentId,
}: TournamentAdminBarProps) {
  const trpc = useTRPC();
  const router = useRouter();

  const { data: participants } = useQuery(
    trpc.participants.list.queryOptions({ tournamentId })
  );
  const participantCount = participants?.length ?? initialParticipantCount;

  const startMutation = useMutation(
    trpc.tournaments.start.mutationOptions({
      onSuccess: () => {
        toast.success("Tournament started!");
        router.push(`/tournaments/${slug}/bracket`);
        router.refresh();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (status === "PENDING") {
    if (participantCount === 0) {
      return (
        <div className="rounded-lg bg-muted px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Add participants to get started.</p>
          <Button size="sm" asChild>
            <Link href={`/tournaments/${slug}/participants`}>Add Participants</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="rounded-lg bg-muted px-4 py-3 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Ready to start? Start the tournament when you&apos;re set.
        </p>
        <Button
          size="sm"
          onClick={() => startMutation.mutate({ id: tournamentId })}
          disabled={startMutation.isPending}
        >
          {startMutation.isPending ? "Starting..." : "Start Tournament"}
        </Button>
      </div>
    );
  }

  if (status === "UNDERWAY") {
    return (
      <div className="rounded-lg bg-muted px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Report scores until the tournament is complete.
        </p>
      </div>
    );
  }

  if (status === "COMPLETE") {
    return (
      <div className="rounded-lg bg-muted px-4 py-3 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Tournament complete. View the final standings.
        </p>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/tournaments/${slug}/standings`}>View Standings</Link>
        </Button>
      </div>
    );
  }

  return null;
}
