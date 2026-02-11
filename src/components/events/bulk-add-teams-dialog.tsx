"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BulkAddTeamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (teams: { name: string }[]) => void;
  isPending: boolean;
}

export function BulkAddTeamsDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: BulkAddTeamsDialogProps) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const teams = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    if (teams.length === 0) return;
    onSubmit(teams);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setText(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Add Teams</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Team names (one per line)</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Team Alpha\nTeam Bravo\nTeam Charlie"}
              rows={8}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {text.split("\n").filter((s) => s.trim()).length} team(s) will be
            added. Duplicates will be skipped.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !text.trim()}>
              {isPending ? "Adding..." : "Add Teams"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
