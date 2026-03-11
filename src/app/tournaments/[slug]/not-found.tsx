import Link from "next/link";

export default function TournamentNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold">Tournament not found</h2>
        <p className="text-sm text-muted-foreground">
          The tournament you&apos;re looking for doesn&apos;t exist or isn&apos;t publicly available.
        </p>
        <Link
          href="/tournaments"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Browse tournaments
        </Link>
      </div>
    </div>
  );
}
