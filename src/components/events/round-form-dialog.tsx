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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type RoundType = "ROUND_ROBIN" | "SINGLE_ELIM" | "DOUBLE_ELIM" | "SWISS" | "CUSTOM";

interface RoundFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    type: RoundType;
    drawsAllowed: boolean;
  }) => void;
  isPending: boolean;
}

export function RoundFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: RoundFormDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<RoundType>("ROUND_ROBIN");
  const [drawsAllowed, setDrawsAllowed] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setType("ROUND_ROBIN");
      setDrawsAllowed(false);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), type, drawsAllowed });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Round</DialogTitle>
          <DialogDescription>Configure the round settings.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="round-name">Round Name *</Label>
            <Input
              id="round-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Pool Play"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Round Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as RoundType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                <SelectItem value="SINGLE_ELIM">
                  Single Elimination
                </SelectItem>
                <SelectItem value="DOUBLE_ELIM">
                  Double Elimination
                </SelectItem>
                <SelectItem value="SWISS">Swiss</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="round-draws"
              checked={drawsAllowed}
              onCheckedChange={(checked) => setDrawsAllowed(checked === true)}
            />
            <Label htmlFor="round-draws">Allow draws</Label>
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
              {isPending ? "Creating..." : "Create Round"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
