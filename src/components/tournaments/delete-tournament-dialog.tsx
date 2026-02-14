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

export function DeleteTournamentDialog({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const deleteTournament = useMutation(
    trpc.tournaments.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.tournaments.list.queryFilter());
        queryClient.invalidateQueries(trpc.tournaments.getStats.queryFilter());
        toast.success("Tournament deleted");
        router.push("/dashboard/tournaments");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Tournament</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Tournament</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this tournament? This action cannot be
            undone. All associated data (teams, rounds, schedules) will be
            permanently removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteTournament.mutate({ id: tournamentId })}
            disabled={deleteTournament.isPending}
          >
            {deleteTournament.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
