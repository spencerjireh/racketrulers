"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { TeamsManager } from "@/components/events/teams-manager";
import { CategoryTeamAssignment } from "@/components/events/category-team-assignment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const trpc = useTRPC();

  const { data: event } = useQuery(trpc.events.getById.queryOptions({ id }));
  const { data: categories } = useQuery(
    trpc.categories.list.queryOptions({ eventId: id })
  );

  const isDraft = event?.status === "DRAFT";

  return (
    <div className="space-y-6">
      <TeamsManager eventId={id} />

      {categories && categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Category Assignments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categories.map((cat) => (
              <div key={cat.id} className="space-y-2">
                <h4 className="text-sm font-medium">{cat.name}</h4>
                <CategoryTeamAssignment
                  categoryId={cat.id}
                  eventId={id}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isDraft && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/dashboard/events/${id}/manage/format`)
            }
          >
            Back: Format
          </Button>
          <Button
            onClick={() =>
              router.push(`/dashboard/events/${id}/manage/rounds`)
            }
          >
            Next: Rounds
          </Button>
        </div>
      )}
    </div>
  );
}
