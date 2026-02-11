"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ScoreEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (scores: { scoreTeam1: number; scoreTeam2: number }) => void;
  onForfeit?: (winnerId: string) => void;
  onCancel?: () => void;
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
  currentScore?: { scoreTeam1: number | null; scoreTeam2: number | null };
  isPending: boolean;
}

export function ScoreEntryDialog({
  open,
  onOpenChange,
  onSubmit,
  onForfeit,
  onCancel,
  team1,
  team2,
  currentScore,
  isPending,
}: ScoreEntryDialogProps) {
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");

  useEffect(() => {
    if (open) {
      setScore1(currentScore?.scoreTeam1?.toString() ?? "");
      setScore2(currentScore?.scoreTeam2?.toString() ?? "");
    }
  }, [open, currentScore]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const s1 = parseInt(score1);
    const s2 = parseInt(score2);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) return;
    onSubmit({ scoreTeam1: s1, scoreTeam2: s2 });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Score</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="space-y-2 text-center">
              <Label className="text-sm font-medium">
                {team1?.name ?? "TBD"}
              </Label>
              <Input
                type="number"
                min={0}
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                className="text-center text-2xl h-14"
                placeholder="0"
              />
            </div>
            <span className="text-lg font-bold text-muted-foreground pt-6">
              vs
            </span>
            <div className="space-y-2 text-center">
              <Label className="text-sm font-medium">
                {team2?.name ?? "TBD"}
              </Label>
              <Input
                type="number"
                min={0}
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                className="text-center text-2xl h-14"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-between">
            <div className="flex gap-1">
              {onForfeit && team1 && team2 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => onForfeit(team1.id)}
                  >
                    Forfeit: {team2.name}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => onForfeit(team2.id)}
                  >
                    Forfeit: {team1.name}
                  </Button>
                </>
              )}
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive"
                  onClick={onCancel}
                >
                  Cancel Game
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={isPending || score1 === "" || score2 === ""}
              >
                {isPending ? "Saving..." : "Save Score"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
