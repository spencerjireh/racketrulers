"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";

export function PublicParticipantsView({ tournamentId }: { tournamentId: string }) {
  const trpc = useTRPC();
  const { data: participants, isLoading } = useQuery(
    trpc.participants.listPublic.queryOptions({ tournamentId })
  );

  if (isLoading) {
    return <LoadingState text="Loading participants..." />;
  }

  if (!participants || participants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No participants yet.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Seed</TableHead>
          <TableHead>Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {participants.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="text-muted-foreground">{p.seed}</TableCell>
            <TableCell className="font-medium">{p.name}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
