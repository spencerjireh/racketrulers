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
import { TeamFormDialog } from "./team-form-dialog";
import { BulkAddTeamsDialog } from "./bulk-add-teams-dialog";

export function TeamsManager({ tournamentId }: { tournamentId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingTeam, setEditingTeam] = useState<{
    id: string;
    name: string;
    captainName: string | null;
    captainEmail: string | null;
    roster: unknown;
  } | null>(null);

  const { data: teams, isLoading } = useQuery(
    trpc.teams.list.queryOptions({ tournamentId })
  );

  const createTeam = useMutation(
    trpc.teams.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.teams.list.queryFilter({ tournamentId }));
        setShowForm(false);
        toast.success("Team added");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateTeam = useMutation(
    trpc.teams.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.teams.list.queryFilter({ tournamentId }));
        setEditingTeam(null);
        toast.success("Team updated");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteTeam = useMutation(
    trpc.teams.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.teams.list.queryFilter({ tournamentId }));
        toast.success("Team deleted");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const bulkCreate = useMutation(
    trpc.teams.bulkCreate.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries(trpc.teams.list.queryFilter({ tournamentId }));
        setShowBulk(false);
        toast.success(
          `${result.created} team(s) added${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`
        );
      },
      onError: (err) => toast.error(err.message),
    })
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Teams</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            Bulk Add
          </Button>
          <Button onClick={() => setShowForm(true)}>Add Team</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState text="Loading teams..." />
        ) : teams && teams.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Captain</TableHead>
                <TableHead>Games</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.captainName || "-"}</TableCell>
                  <TableCell>
                    {team._count.gamesAsTeam1 + team._count.gamesAsTeam2}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTeam(team)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (
                            confirm(
                              `Delete team "${team.name}"? This cannot be undone.`
                            )
                          ) {
                            deleteTeam.mutate({ id: team.id, tournamentId });
                          }
                        }}
                        disabled={deleteTeam.isPending}
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
            No teams added yet. Add teams individually or use bulk add.
          </p>
        )}
      </CardContent>

      <TeamFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={(data) =>
          createTeam.mutate({ tournamentId, ...data })
        }
        isPending={createTeam.isPending}
      />

      <TeamFormDialog
        open={!!editingTeam}
        onOpenChange={(open) => {
          if (!open) setEditingTeam(null);
        }}
        onSubmit={(data) => {
          if (editingTeam) {
            updateTeam.mutate({ id: editingTeam.id, tournamentId, ...data });
          }
        }}
        initialData={editingTeam ?? undefined}
        isPending={updateTeam.isPending}
      />

      <BulkAddTeamsDialog
        open={showBulk}
        onOpenChange={setShowBulk}
        onSubmit={(teams) => bulkCreate.mutate({ tournamentId, teams })}
        isPending={bulkCreate.isPending}
      />
    </Card>
  );
}
