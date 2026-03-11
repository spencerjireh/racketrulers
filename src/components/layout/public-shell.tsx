import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SiteHeader } from "@/components/public/site-header";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (session?.user) {
    return <DashboardShell user={session.user}>{children}</DashboardShell>;
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mt-16">{children}</div>
    </div>
  );
}
