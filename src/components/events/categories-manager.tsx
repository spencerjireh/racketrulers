"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CategoryFormDialog } from "./category-form-dialog";
import { CategoryTeamAssignment } from "./category-team-assignment";
import { LoadingState } from "@/components/ui/loading-state";

export function CategoriesManager({ eventId }: { eventId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    name: string;
    drawsAllowed: boolean;
  } | null>(null);
  const [expandedId, setExpandedId] = usePersistedState<string | null>(
    `collapsible:categories:${eventId}`,
    null
  );

  const { data: categories, isLoading } = useQuery(
    trpc.categories.list.queryOptions({ eventId })
  );

  const createCategory = useMutation(
    trpc.categories.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.categories.list.queryFilter({ eventId })
        );
        setShowForm(false);
        toast.success("Category added");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateCategory = useMutation(
    trpc.categories.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.categories.list.queryFilter({ eventId })
        );
        setEditingCategory(null);
        toast.success("Category updated");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteCategory = useMutation(
    trpc.categories.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.categories.list.queryFilter({ eventId })
        );
        toast.success("Category deleted");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Categories</CardTitle>
        <Button onClick={() => setShowForm(true)}>Add Category</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState text="Loading categories..." />
        ) : categories && categories.length > 0 ? (
          <div className="space-y-2">
            {categories.map((cat) => (
              <Collapsible
                key={cat.id}
                open={expandedId === cat.id}
                onOpenChange={(open) =>
                  setExpandedId(open ? cat.id : null)
                }
              >
                <div className="rounded border">
                  <div className="flex items-center justify-between p-3">
                    <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer">
                      {expandedId === cat.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{cat.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {cat._count.categoryTeams} team(s), {cat._count.rounds}{" "}
                        round(s)
                      </span>
                      {cat.drawsAllowed && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          Draws
                        </span>
                      )}
                    </CollapsibleTrigger>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategory(cat);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            confirm(
                              `Delete category "${cat.name}"? This will also delete all rounds and games in this category.`
                            )
                          ) {
                            deleteCategory.mutate({ id: cat.id, eventId });
                          }
                        }}
                        disabled={deleteCategory.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="border-t p-3">
                      <CategoryTeamAssignment
                        categoryId={cat.id}
                        eventId={eventId}
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No categories yet. Categories group teams for different divisions
            (e.g., U18 Boys, Open Women).
          </p>
        )}
      </CardContent>

      <CategoryFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={(data) => createCategory.mutate({ eventId, ...data })}
        isPending={createCategory.isPending}
      />

      <CategoryFormDialog
        open={!!editingCategory}
        onOpenChange={(open) => {
          if (!open) setEditingCategory(null);
        }}
        onSubmit={(data) => {
          if (editingCategory) {
            updateCategory.mutate({ id: editingCategory.id, eventId, ...data });
          }
        }}
        initialData={editingCategory ?? undefined}
        isPending={updateCategory.isPending}
      />
    </Card>
  );
}
