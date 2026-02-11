"use client";

import { use } from "react";
import { ScheduleView } from "@/components/events/schedule-view";

export default function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ScheduleView eventId={id} />;
}
