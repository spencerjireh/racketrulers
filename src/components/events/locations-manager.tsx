"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function LocationsManager({ eventId }: { eventId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: locations, isLoading } = useQuery(
    trpc.locations.list.queryOptions({ eventId })
  );

  const createLocation = useMutation(
    trpc.locations.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.locations.list.queryFilter({ eventId })
        );
        setNewName("");
        toast.success("Court added");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateLocation = useMutation(
    trpc.locations.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.locations.list.queryFilter({ eventId })
        );
        setEditingId(null);
        toast.success("Court updated");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteLocation = useMutation(
    trpc.locations.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.locations.list.queryFilter({ eventId })
        );
        toast.success("Court deleted");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createLocation.mutate({ eventId, name: newName.trim() });
  }

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditName(name);
  }

  function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    updateLocation.mutate({ id, eventId, name: editName.trim() });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Courts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder="Court name (e.g. Court 1)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" disabled={createLocation.isPending}>
            {createLocation.isPending ? "Adding..." : "Add Court"}
          </Button>
        </form>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading courts...</p>
        ) : locations && locations.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Games</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell>
                    {editingId === location.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveEdit(location.id);
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(location.id)}
                          disabled={updateLocation.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="text-left hover:underline cursor-pointer"
                        onClick={() => startEdit(location.id, location.name)}
                      >
                        {location.name}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>{location._count.games}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (
                          location._count.games > 0 &&
                          !confirm(
                            `This location has ${location._count.games} game(s) assigned. Delete anyway?`
                          )
                        ) {
                          return;
                        }
                        deleteLocation.mutate({ id: location.id, eventId });
                      }}
                      disabled={deleteLocation.isPending}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            No courts added yet. Add courts above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
