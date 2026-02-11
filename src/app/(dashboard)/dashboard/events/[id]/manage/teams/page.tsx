"use client";

import { use } from "react";
import { TeamsManager } from "@/components/events/teams-manager";

export default function TeamsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <TeamsManager eventId={id} />;
}
