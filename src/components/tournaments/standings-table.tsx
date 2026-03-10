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

interface StandingsTableProps {
  tournamentId: string;
  title?: string;
}

export function StandingsTable({ tournamentId, title }: StandingsTableProps) {
  const trpc = useTRPC();

  const { data: standings } = useQuery(
    trpc.matches.getStandings.queryOptions({ tournamentId })
  );

  if (!standings || standings.length === 0) return null;

  return (
    <div>
      {title && (
        <h4 className="text-sm font-medium mb-2">{title}</h4>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead className="text-center w-10">GP</TableHead>
            <TableHead className="text-center w-10">W</TableHead>
            <TableHead className="text-center w-10">D</TableHead>
            <TableHead className="text-center w-10">L</TableHead>
            <TableHead className="text-center w-12">PF</TableHead>
            <TableHead className="text-center w-12">PA</TableHead>
            <TableHead className="text-center w-12">PD</TableHead>
            <TableHead className="text-center w-12">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((s) => (
            <TableRow key={s.participantId}>
              <TableCell className="font-medium">{s.rank}</TableCell>
              <TableCell>{s.participantName}</TableCell>
              <TableCell className="text-center">{s.gamesPlayed}</TableCell>
              <TableCell className="text-center">{s.wins}</TableCell>
              <TableCell className="text-center">{s.draws}</TableCell>
              <TableCell className="text-center">{s.losses}</TableCell>
              <TableCell className="text-center">{s.pointsFor}</TableCell>
              <TableCell className="text-center">{s.pointsAgainst}</TableCell>
              <TableCell className="text-center">{s.pointDifferential}</TableCell>
              <TableCell className="text-center font-bold">
                {s.standingPoints}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
