"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RoundsManager } from "./rounds-manager";

interface RoundsStepProps {
  eventId: string;
}

export function RoundsStep({ eventId }: RoundsStepProps) {
  const trpc = useTRPC();
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery(
    trpc.categories.list.queryOptions({ eventId })
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!categories || categories.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No categories yet. Go back to the Format step to create categories
            first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <Card key={cat.id}>
          <Collapsible
            open={expandedCat === cat.id || categories.length === 1}
            onOpenChange={(open) =>
              setExpandedCat(open ? cat.id : null)
            }
          >
            <CardHeader className="cursor-pointer pb-3">
              <CollapsibleTrigger className="flex items-center gap-2 w-full">
                {categories.length > 1 &&
                  (expandedCat === cat.id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  ))}
                <CardTitle className="text-base">{cat.name}</CardTitle>
                <span className="text-xs text-muted-foreground ml-2">
                  {cat._count.categoryTeams} team(s), {cat._count.rounds} round(s)
                </span>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <RoundsManager categoryId={cat.id} eventId={eventId} />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
}
