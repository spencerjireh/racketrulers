"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CascadeWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  downstreamCount: number;
  scoredCount: number;
  isPending?: boolean;
}

export function CascadeWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  downstreamCount,
  scoredCount,
  isPending,
}: CascadeWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cascade Warning</AlertDialogTitle>
          <AlertDialogDescription>
            Changing the winner will affect{" "}
            <strong>{downstreamCount}</strong> downstream game
            {downstreamCount !== 1 ? "s" : ""}
            {scoredCount > 0 && (
              <>
                , <strong>{scoredCount}</strong> of which{" "}
                {scoredCount === 1 ? "has" : "have"} scores that will be
                cleared
              </>
            )}
            . This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? "Updating..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
