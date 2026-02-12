import { TourneyHubLogo } from "@/components/tourneyhub-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Decorative brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between">
        <div className="hero-grid absolute inset-0 text-primary-foreground opacity-[0.08]" />

        <div className="relative p-12">
          <TourneyHubLogo
            variant="full"
            size={28}
            inverse
            className="text-primary-foreground"
          />
        </div>

        <div className="relative px-12 pb-12">
          <blockquote className="text-2xl font-medium leading-relaxed text-primary-foreground/90">
            &ldquo;TourneyHub transformed how we run our league. What used to
            take hours now takes minutes.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-primary-foreground/60">
            -- Sarah Chen, League Organizer
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <TourneyHubLogo variant="full" size={28} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
