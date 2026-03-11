"use client";

import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ScoringConfig, type SetScore, DEFAULT_SCORING_CONFIG } from "@/server/lib/scoring-validation";

interface ScoreEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { setScores: SetScore[] }) => void;
  onForfeit?: (winnerId: string) => void;
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
  scoringConfig: ScoringConfig;
  currentSetScores?: SetScore[] | null;
  isPending: boolean;
}

export function ScoreEntryDialog({
  open,
  onOpenChange,
  onSubmit,
  onForfeit,
  team1,
  team2,
  scoringConfig = DEFAULT_SCORING_CONFIG,
  currentSetScores,
  isPending,
}: ScoreEntryDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Enter Set Scores</SheetTitle>
          <SheetDescription>Enter the set scores for this match.</SheetDescription>
        </SheetHeader>
        {open && (
          <ScoreEntryForm
            scoringConfig={scoringConfig}
            currentSetScores={currentSetScores}
            team1={team1}
            team2={team2}
            onSubmit={onSubmit}
            onForfeit={onForfeit}
            onOpenChange={onOpenChange}
            isPending={isPending}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ScoreEntryForm({
  scoringConfig,
  currentSetScores,
  team1,
  team2,
  onSubmit,
  onForfeit,
  onOpenChange,
  isPending,
}: {
  scoringConfig: ScoringConfig;
  currentSetScores?: SetScore[] | null;
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
  onSubmit: (data: { setScores: SetScore[] }) => void;
  onForfeit?: (winnerId: string) => void;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
}) {
  const config = scoringConfig ?? DEFAULT_SCORING_CONFIG;

  const [sets, setSets] = useState<{ t1: string; t2: string }[]>(() => {
    if (currentSetScores && currentSetScores.length > 0) {
      return currentSetScores.map((s) => ({
        t1: s.team1.toString(),
        t2: s.team2.toString(),
      }));
    }
    return Array.from({ length: config.totalSets }, () => ({ t1: "", t2: "" }));
  });

  const [error, setError] = useState("");

  function updateSet(index: number, field: "t1" | "t2", value: string) {
    setSets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setError("");
  }

  const setsToWin = Math.ceil(config.totalSets / 2);

  const { tally, matchDecided, setsWonPerIndex } = useMemo(() => {
    const t = { team1: 0, team2: 0 };
    let decided = false;
    const perIndex: { team1: number; team2: number }[] = [{ team1: 0, team2: 0 }];

    for (const set of sets) {
      const s1 = parseInt(set.t1);
      const s2 = parseInt(set.t2);
      if (isNaN(s1) || isNaN(s2)) break;
      if (s1 > s2) t.team1++;
      else if (s2 > s1) t.team2++;
      if (t.team1 === setsToWin || t.team2 === setsToWin) {
        decided = true;
        perIndex.push({ team1: t.team1, team2: t.team2 });
        break;
      }
      perIndex.push({ team1: t.team1, team2: t.team2 });
    }

    return { tally: t, matchDecided: decided, setsWonPerIndex: perIndex };
  }, [sets, setsToWin]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

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
    <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
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
          const before = setsWonPerIndex[i] ?? { team1: 0, team2: 0 };
          const setDisabled =
            before.team1 === setsToWin ||
            before.team2 === setsToWin;

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

      {onForfeit && team1 && team2 && (
        <div className="flex flex-wrap gap-1">
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
  );
}
