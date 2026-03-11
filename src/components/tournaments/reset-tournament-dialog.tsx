"use client";

import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";

interface ResetTournamentDialogProps {
  tournamentId: string;
  slug: string;
  variant?: "default" | "danger-zone";
}

export function ResetTournamentDialog({
  tournamentId,
  slug,
  variant = "default",
}: ResetTournamentDialogProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const resetTournament = useMutation(
    trpc.tournaments.reset.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.tournaments.getBySlug.queryFilter());
        queryClient.invalidateQueries(trpc.tournaments.getById.queryFilter());
        queryClient.invalidateQueries(trpc.tournaments.list.queryFilter());
        queryClient.invalidateQueries(trpc.tournaments.getStats.queryFilter());
        queryClient.invalidateQueries(trpc.matches.getBracketData.queryFilter());
        queryClient.invalidateQueries(trpc.matches.getBracketDataPublic.queryFilter());
        queryClient.invalidateQueries(trpc.matches.listByTournament.queryFilter());
        toast.success("Tournament reset to pending");
        setOpen(false);
        router.push(`/tournaments/${slug}/participants`);
        router.refresh();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "danger-zone" ? (
          <Button variant="destructive">Reset Tournament</Button>
        ) : (
          <Button variant="outline" size="sm">
            Reset
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Tournament</DialogTitle>
          <DialogDescription>
            This will delete all matches and scores, returning the tournament to
            pending status. Participants will be preserved. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => resetTournament.mutate({ id: tournamentId })}
            disabled={resetTournament.isPending}
          >
            {resetTournament.isPending ? "Resetting..." : "Reset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
