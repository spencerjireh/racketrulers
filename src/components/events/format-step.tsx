"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { CategoriesManager } from "./categories-manager";
import { toast } from "sonner";

const TEMPLATES = [
  {
    id: "round_robin" as const,
    name: "Round Robin",
    description: "Every team plays every other team. Best for smaller groups.",
  },
  {
    id: "rr_playoffs" as const,
    name: "Round Robin + Playoffs",
    description: "Group stage followed by single elimination bracket for top teams.",
  },
  {
    id: "single_elim" as const,
    name: "Single Elimination",
    description: "Standard bracket. Lose once and you're out.",
  },
  {
    id: "double_elim" as const,
    name: "Double Elimination",
    description: "Teams must lose twice to be eliminated. Winners and losers brackets.",
  },
];

interface FormatStepProps {
  eventId: string;
}

export function FormatStep({ eventId }: FormatStepProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery(
    trpc.categories.list.queryOptions({ eventId })
  );

  const applyTemplate = useMutation(
    trpc.events.applyTemplate.mutationOptions({
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries(
          trpc.categories.list.queryFilter({ eventId })
        );
        const name = TEMPLATES.find((t) => t.id === variables.template)?.name;
        toast.success(`Applied "${name}" template`);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const hasCategories = categories && categories.length > 0;

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      {!hasCategories ? (
        <Card>
          <CardHeader>
            <CardTitle>Choose a Tournament Format</CardTitle>
            <CardDescription>
              Select a template to get started quickly, or add categories
              manually below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  className="rounded-lg border p-4 text-left hover:border-primary hover:bg-accent transition-colors"
                  onClick={() =>
                    applyTemplate.mutate({
                      eventId,
                      template: template.id,
                    })
                  }
                  disabled={applyTemplate.isPending}
                >
                  <h3 className="font-semibold text-sm">{template.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {template.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <CategoriesManager eventId={eventId} />
    </div>
  );
}
