"use client";

import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pending", variant: "outline" },
  OPEN: { label: "In Progress", variant: "default" },
  COMPLETE: { label: "Completed", variant: "secondary" },
  FORFEIT: { label: "Forfeit", variant: "destructive" },
};

export function GameStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
