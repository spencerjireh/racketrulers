import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TourneyHubLogo } from "@/components/tourneyhub-logo";
import { Trophy, Zap, Calendar, Users, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Trophy,
    title: "Tournament Management",
    description:
      "Create and manage multi-sport tournaments with round robin, Swiss, single elimination, and double elimination formats.",
  },
  {
    icon: Zap,
    title: "Real-time Scores",
    description:
      "Live score updates, automatic standings calculations, and instant bracket advancement -- all updating in real time.",
  },
  {
    icon: Calendar,
    title: "Coach Scheduler",
    description:
      "Publish your coaching availability and share a booking link. Parents and players book sessions without needing an account.",
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Manage teams, rosters, seedings, and category assignments. Handle multi-day events with drag-and-drop scheduling.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Navigation ─── */}
      <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <TourneyHubLogo variant="full" size={28} />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">
                Get started
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden pt-16">
        {/* Grid pattern */}
        <div className="hero-grid absolute inset-0 text-foreground opacity-[0.04]" />

        {/* Gradient orbs */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />
        <div className="pointer-events-none absolute right-1/4 top-2/3 h-[300px] w-[300px] rounded-full bg-chart-2/10 blur-[80px]" />

        <div className="relative mx-auto max-w-5xl px-6 text-center">
          {/* Status pill */}
          <div className="animate-fade-up mb-8 inline-flex items-center gap-2.5 rounded-full border border-border/60 bg-card/40 px-4 py-1.5 text-sm backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-muted-foreground">
              Now with real-time score updates
            </span>
          </div>

          {/* Headline */}
          <h1
            className="animate-fade-up text-5xl font-bold tracking-tight sm:text-7xl lg:text-8xl"
            style={{ animationDelay: "0.1s" }}
          >
            Run tournaments{" "}
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              like a pro.
            </span>
          </h1>

          {/* Subtext */}
          <p
            className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
            style={{ animationDelay: "0.2s" }}
          >
            The all-in-one platform for managing multi-sport tournaments and
            coaching sessions. Brackets, live scores, scheduling -- everything
            you need.
          </p>

          {/* CTAs */}
          <div
            className="animate-fade-up mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
            style={{ animationDelay: "0.3s" }}
          >
            <Button
              size="lg"
              className="glow-primary h-12 px-8 text-base"
              asChild
            >
              <Link href="/signup">
                Start for free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base"
              asChild
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>

          {/* Stats */}
          <div
            className="animate-fade-up mt-20 flex items-center justify-center gap-8 sm:gap-16"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums sm:text-4xl">
                500+
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Tournaments
              </div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums sm:text-4xl">
                2.5k+
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Teams</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums sm:text-4xl">
                99.9%
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Features
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to compete
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              From bracket generation to live scoring, TourneyHub handles every
              aspect of tournament management.
            </p>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/30 p-8 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:bg-card/60"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative">
                  <div className="inline-flex rounded-lg border border-border/50 bg-background/50 p-2.5">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="border-t border-border/40">
        <div className="relative overflow-hidden py-24">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="relative mx-auto max-w-6xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to run your next tournament?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join hundreds of organizers who trust TourneyHub to power their
              competitive events.
            </p>
            <Button
              size="lg"
              className="glow-primary mt-8 h-12 px-8 text-base"
              asChild
            >
              <Link href="/signup">
                Get started for free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <TourneyHubLogo variant="full" size={22} />
          <p className="text-sm text-muted-foreground">
            Multi-sport tournament management platform
          </p>
        </div>
      </footer>
    </div>
  );
}
