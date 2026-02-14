"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface PointsConfigFormProps {
  tournamentId: string;
  pointsConfig: { win: number; draw: number; loss: number };
  disabled: boolean;
}

export function PointsConfigForm({
  tournamentId,
  pointsConfig,
  disabled,
}: PointsConfigFormProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateTournament = useMutation(
    trpc.tournaments.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.tournaments.getById.queryFilter({ id: tournamentId }));
        toast.success("Points configuration saved");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    updateTournament.mutate({
      id: tournamentId,
      pointsConfig: {
        win: Number(formData.get("win")),
        draw: Number(formData.get("draw")),
        loss: Number(formData.get("loss")),
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="win">Win</Label>
          <Input
            id="win"
            name="win"
            type="number"
            defaultValue={pointsConfig.win}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="draw">Draw</Label>
          <Input
            id="draw"
            name="draw"
            type="number"
            defaultValue={pointsConfig.draw}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loss">Loss</Label>
          <Input
            id="loss"
            name="loss"
            type="number"
            defaultValue={pointsConfig.loss}
            disabled={disabled}
          />
        </div>
      </div>
      <Button type="submit" disabled={disabled || updateTournament.isPending}>
        {updateTournament.isPending ? "Saving..." : "Save Points"}
      </Button>
    </form>
  );
}
