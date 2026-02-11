"use client";

import { use } from "react";
import { ScoresManager } from "@/components/events/scores-manager";

export default function ScoresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ScoresManager eventId={id} />;
}
