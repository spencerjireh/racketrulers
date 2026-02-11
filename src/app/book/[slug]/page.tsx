"use client";

import { use } from "react";
import { BookingPage } from "@/components/coach/booking-page";

export default function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <BookingPage slug={slug} />
      </div>
    </div>
  );
}
