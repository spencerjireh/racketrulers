"use client";

import { use } from "react";
import { CategoriesManager } from "@/components/events/categories-manager";

export default function CategoriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CategoriesManager eventId={id} />;
}
