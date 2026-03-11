import { BookingPage } from "@/components/coach/booking-page";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-5xl py-8">
      <BookingPage slug={slug} />
    </div>
  );
}
