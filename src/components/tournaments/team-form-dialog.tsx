"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

interface TeamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    captainName: string;
    captainEmail: string;
    roster: string[];
  }) => void;
  initialData?: {
    name: string;
    captainName: string | null;
    captainEmail: string | null;
    roster: unknown;
  };
  isPending: boolean;
}

export function TeamFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isPending,
}: TeamFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Team" : "Add Team"}</DialogTitle>
          <DialogDescription>{initialData ? "Update team details." : "Add a new team to the tournament."}</DialogDescription>
        </DialogHeader>
        {open && (
          <TeamForm
            initialData={initialData}
            onSubmit={onSubmit}
            onOpenChange={onOpenChange}
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TeamForm({
  initialData,
  onSubmit,
  onOpenChange,
  isPending,
}: {
  initialData?: TeamFormDialogProps["initialData"];
  onSubmit: TeamFormDialogProps["onSubmit"];
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(() => initialData?.name ?? "");
  const [captainName, setCaptainName] = useState(() => initialData?.captainName ?? "");
  const [captainEmail, setCaptainEmail] = useState(() => initialData?.captainEmail ?? "");
  const [rosterText, setRosterText] = useState(() => {
    const roster = Array.isArray(initialData?.roster) ? initialData.roster : [];
    return roster.join("\n");
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const roster = rosterText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    onSubmit({ name: name.trim(), captainName, captainEmail, roster });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="team-name">Team Name *</Label>
        <Input
          id="team-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Team name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="captain-name">Captain Name</Label>
        <Input
          id="captain-name"
          value={captainName}
          onChange={(e) => setCaptainName(e.target.value)}
          placeholder="Captain name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="captain-email">Captain Email</Label>
        <Input
          id="captain-email"
          type="email"
          value={captainEmail}
          onChange={(e) => setCaptainEmail(e.target.value)}
          placeholder="captain@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="roster">Roster (one player per line)</Label>
        <Textarea
          id="roster"
          value={rosterText}
          onChange={(e) => setRosterText(e.target.value)}
          placeholder={"Player 1\nPlayer 2\nPlayer 3"}
          rows={5}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? "Saving..." : initialData ? "Update" : "Add Team"}
        </Button>
      </div>
    </form>
  );
}
