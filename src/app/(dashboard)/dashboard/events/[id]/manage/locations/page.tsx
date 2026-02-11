"use client";

import { use } from "react";
import { LocationsManager } from "@/components/events/locations-manager";

export default function LocationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <LocationsManager eventId={id} />;
}
