"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { RoundsStep } from "@/components/events/rounds-step";
import { Button } from "@/components/ui/button";

export default function RoundsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const trpc = useTRPC();
  const { data: event } = useQuery(trpc.events.getById.queryOptions({ id }));

  const isDraft = event?.status === "DRAFT";

  return (
    <div className="space-y-6">
      <RoundsStep eventId={id} />

      {isDraft && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/dashboard/events/${id}/manage/teams`)
            }
          >
            Back: Teams
          </Button>
          <Button
            onClick={() =>
              router.push(`/dashboard/events/${id}/manage/schedule`)
            }
          >
            Next: Schedule
          </Button>
        </div>
      )}
    </div>
  );
}
