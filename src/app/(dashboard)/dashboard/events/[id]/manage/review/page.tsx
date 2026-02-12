"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ReviewStep } from "@/components/events/review-step";
import { Button } from "@/components/ui/button";

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <div className="space-y-6">
      <ReviewStep eventId={id} />

      <div className="flex justify-start">
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/dashboard/events/${id}/manage/schedule`)
          }
        >
          Back: Schedule
        </Button>
      </div>
    </div>
  );
}
