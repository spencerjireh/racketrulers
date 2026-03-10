"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TeamFormDialog } from "./team-form-dialog";
import { BulkAddTeamsDialog } from "./bulk-add-teams-dialog";

export function TeamsManager({ tournamentId }: { tournamentId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editingTeam, setEditingTeam] = useState<{
    id: string;
    name: string;
    captainName: string | null;
    captainEmail: string | null;
    roster: unknown;
  } | null>(null);

  const { data: participants, isLoading } = useQuery(
    trpc.participants.list.queryOptions({ tournamentId })
  );

  const createParticipant = useMutation(
    trpc.participants.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.participants.list.queryFilter({ tournamentId }));
        setShowForm(false);
        toast.success("Participant added");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateParticipant = useMutation(
    trpc.participants.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.participants.list.queryFilter({ tournamentId }));
        setEditingTeam(null);
        toast.success("Participant updated");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteParticipant = useMutation(
    trpc.participants.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.participants.list.queryFilter({ tournamentId }));
        toast.success("Participant deleted");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const bulkCreate = useMutation(
    trpc.participants.bulkCreate.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries(trpc.participants.list.queryFilter({ tournamentId }));
        setShowBulk(false);
        toast.success(
          `${result.created} participant(s) added${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`
        );
      },
      onError: (err) => toast.error(err.message),
    })
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Participants</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            Bulk Add
          </Button>
          <Button onClick={() => setShowForm(true)}>Add Participant</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState text="Loading participants..." />
        ) : participants && participants.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Captain</TableHead>
                <TableHead>Matches</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.captainName || "-"}</TableCell>
                  <TableCell>
                    {p._count.matchesAsParticipant1 + p._count.matchesAsParticipant2}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTeam(p)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                        disabled={deleteParticipant.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            No participants added yet. Add participants individually or use bulk add.
          </p>
        )}
      </CardContent>

      <TeamFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={(data) =>
          createParticipant.mutate({ tournamentId, ...data })
        }
        isPending={createParticipant.isPending}
      />

      <TeamFormDialog
        open={!!editingTeam}
        onOpenChange={(open) => {
          if (!open) setEditingTeam(null);
        }}
        onSubmit={(data) => {
          if (editingTeam) {
            updateParticipant.mutate({ id: editingTeam.id, tournamentId, ...data });
          }
        }}
        initialData={editingTeam ?? undefined}
        isPending={updateParticipant.isPending}
      />

      <BulkAddTeamsDialog
        open={showBulk}
        onOpenChange={setShowBulk}
        onSubmit={(teams) => bulkCreate.mutate({ tournamentId, teams })}
        isPending={bulkCreate.isPending}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the participant. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteParticipant.mutate({ id: deleteTarget.id, tournamentId });
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
