import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RacketRulersLogo } from "@/components/racketrulers-logo";
import { Trophy, Zap, Calendar, Users, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Trophy,
    title: "Tournament Management",
    description:
      "Create and manage badminton tournaments with set-based scoring, singles and doubles support, round robin, Swiss, and elimination formats.",
  },
  {
    icon: Calendar,
    title: "Coach Scheduler",
    description:
      "Publish your coaching availability and share a booking link. Parents and players book sessions without needing an account.",
  },
  {
    icon: Zap,
    title: "Real-time Scores",
    description:
      "Live set-by-set score updates, automatic standings calculations, and instant bracket advancement -- all updating in real time.",
  },
  {
    icon: Users,
    title: "Court & Team Management",
    description:
      "Manage teams, rosters, seedings, and court assignments. Handle multi-day badminton events with drag-and-drop scheduling.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Navigation ─── */}
      <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <RacketRulersLogo size={36} variant="full" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden pb-16">
        {/* Grid pattern */}
        <div className="hero-grid absolute inset-0 text-foreground opacity-[0.04]" />

        {/* Gradient orbs */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />
        <div className="pointer-events-none absolute right-1/4 top-2/3 h-[300px] w-[300px] rounded-full bg-chart-2/10 blur-[80px]" />

        <div className="relative mx-auto max-w-5xl px-6 text-center">
          {/* Headline */}
          <h1
            className="animate-fade-up text-5xl font-bold tracking-tight sm:text-7xl lg:text-8xl"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              RacketRulers.
            </span>{" "}
            Compete and coach like a pro.
          </h1>

          {/* Subtext */}
          <p
            className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
            style={{ animationDelay: "0.2s" }}
          >
            The all-in-one platform for badminton coaching sessions and
            tournaments. Set scoring, court management, live scores, brackets --
            everything you need.
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
              <Link href="/events?tab=coaches">Book a Coach</Link>
            </Button>
            <Button
              size="lg"
              className="glow-primary h-12 px-8 text-base"
              asChild
            >
              <Link href="/events">See Event</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base"
              asChild
            >
              <Link href="/signup">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
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
              From coaching sessions to live set-by-set scoring, RacketRulers
              handles every aspect of your badminton events.
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
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Whether you coach, organize, or compete -- RacketRulers has
              everything you need in one place.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="glow-primary h-12 px-8 text-base"
                asChild
              >
                <Link href="/events?tab=coaches">Book a Coach</Link>
              </Button>
              <Button
                size="lg"
                className="glow-primary h-12 px-8 text-base"
                asChild
              >
                <Link href="/events">See Event</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
                asChild
              >
                <Link href="/signup">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <RacketRulersLogo size={28} />
          <p className="text-sm text-muted-foreground">
            Badminton tournament management and coaching platform
          </p>
        </div>
      </footer>
    </div>
  );
}
