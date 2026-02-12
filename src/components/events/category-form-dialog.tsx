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
import { Checkbox } from "@/components/ui/checkbox";

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; drawsAllowed: boolean }) => void;
  initialData?: { name: string; drawsAllowed: boolean };
  isPending: boolean;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isPending,
}: CategoryFormDialogProps) {
  const [name, setName] = useState("");
  const [drawsAllowed, setDrawsAllowed] = useState(false);

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name);
      setDrawsAllowed(initialData.drawsAllowed);
    } else if (open) {
      setName("");
      setDrawsAllowed(false);
    }
  }, [open, initialData]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), drawsAllowed });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Category" : "Add Category"}
          </DialogTitle>
          <DialogDescription>{initialData ? "Update category details." : "Create a new category for grouping teams."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Category Name *</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., U18 Boys"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="draws-allowed"
              checked={drawsAllowed}
              onCheckedChange={(checked) => setDrawsAllowed(checked === true)}
            />
            <Label htmlFor="draws-allowed">Allow draws</Label>
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
              {isPending
                ? "Saving..."
                : initialData
                  ? "Update"
                  : "Add Category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
