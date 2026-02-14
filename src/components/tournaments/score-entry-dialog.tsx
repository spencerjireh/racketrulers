"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ScoringConfig {
  pointsPerSet: number;
  totalSets: number;
  deuceEnabled: boolean;
  maxPoints: number;
}

interface SetScore {
  team1: number;
  team2: number;
}

interface ScoreEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { setScores: SetScore[] }) => void;
  onForfeit?: (winnerId: string) => void;
  onCancel?: () => void;
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
  scoringConfig: ScoringConfig;
  currentSetScores?: SetScore[] | null;
  isPending: boolean;
}

const DEFAULT_CONFIG: ScoringConfig = {
  pointsPerSet: 21,
  totalSets: 3,
  deuceEnabled: true,
  maxPoints: 30,
};

export function ScoreEntryDialog({
  open,
  onOpenChange,
  onSubmit,
  onForfeit,
  onCancel,
  team1,
  team2,
  scoringConfig = DEFAULT_CONFIG,
  currentSetScores,
  isPending,
}: ScoreEntryDialogProps) {
  const config = scoringConfig ?? DEFAULT_CONFIG;
  const [sets, setSets] = useState<{ t1: string; t2: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      if (currentSetScores && currentSetScores.length > 0) {
        setSets(
          currentSetScores.map((s) => ({
            t1: s.team1.toString(),
            t2: s.team2.toString(),
          }))
        );
      } else {
        // Initialize with empty sets
        setSets(
          Array.from({ length: config.totalSets }, () => ({ t1: "", t2: "" }))
        );
      }
    }
  }, [open, currentSetScores, config.totalSets]);

  function updateSet(index: number, field: "t1" | "t2", value: string) {
    setSets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setError("");
  }

  // Calculate running tally
  const tally = { team1: 0, team2: 0 };
  const setsToWin = Math.ceil(config.totalSets / 2);
  let matchDecided = false;

  for (const set of sets) {
    const t1 = parseInt(set.t1);
    const t2 = parseInt(set.t2);
    if (isNaN(t1) || isNaN(t2)) break;
    if (t1 > t2) tally.team1++;
    else if (t2 > t1) tally.team2++;
    if (tally.team1 === setsToWin || tally.team2 === setsToWin) {
      matchDecided = true;
      break;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Collect filled sets
    const filledSets: SetScore[] = [];
    for (const set of sets) {
      const t1 = parseInt(set.t1);
      const t2 = parseInt(set.t2);
      if (isNaN(t1) || isNaN(t2)) break;
      if (t1 < 0 || t2 < 0) {
        setError("Scores cannot be negative");
        return;
      }
      filledSets.push({ team1: t1, team2: t2 });
    }

    if (filledSets.length === 0) {
      setError("Enter at least one set score");
      return;
    }

    onSubmit({ setScores: filledSets });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enter Set Scores</DialogTitle>
          <DialogDescription>Enter the set scores for this match.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Team headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-medium">
            <span className="text-center truncate">
              {team1?.name ?? "TBD"}
            </span>
            <span className="text-muted-foreground">vs</span>
            <span className="text-center truncate">
              {team2?.name ?? "TBD"}
            </span>
          </div>

          {/* Set rows */}
          <div className="space-y-2">
            {sets.map((set, i) => {
              // Determine if this set should be disabled (match already decided in earlier set)
              let setsWonBefore = { team1: 0, team2: 0 };
              for (let j = 0; j < i; j++) {
                const t1 = parseInt(sets[j].t1);
                const t2 = parseInt(sets[j].t2);
                if (isNaN(t1) || isNaN(t2)) break;
                if (t1 > t2) setsWonBefore.team1++;
                else if (t2 > t1) setsWonBefore.team2++;
              }
              const setDisabled =
                setsWonBefore.team1 === setsToWin ||
                setsWonBefore.team2 === setsToWin;

              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
                >
                  <Input
                    type="number"
                    min={0}
                    value={set.t1}
                    onChange={(e) => updateSet(i, "t1", e.target.value)}
                    className="text-center h-10"
                    placeholder="0"
                    disabled={setDisabled}
                  />
                  <Label className="text-xs text-muted-foreground w-12 text-center">
                    Set {i + 1}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={set.t2}
                    onChange={(e) => updateSet(i, "t2", e.target.value)}
                    className="text-center h-10"
                    placeholder="0"
                    disabled={setDisabled}
                  />
                </div>
              );
            })}
          </div>

          {/* Running tally */}
          <div className="text-center text-sm">
            <span className="font-mono font-bold">
              {tally.team1} - {tally.team2}
            </span>
            <span className="text-muted-foreground ml-2">
              (sets{matchDecided ? " -- match decided" : ""})
            </span>
          </div>

          {/* Validation error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {(onForfeit || onCancel) && team1 && team2 && (
            <div className="flex flex-wrap gap-1">
              {onForfeit && (
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
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Score"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
