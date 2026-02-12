import Link from "next/link";
import { RacketRulersLogo } from "@/components/racketrulers-logo";

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

        <Link href="/" className="relative block p-12">
          <RacketRulersLogo
            size={64}
            inverse
          />
        </Link>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 block lg:hidden">
            <RacketRulersLogo size={40} />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
