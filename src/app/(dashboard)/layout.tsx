import { getRequiredSession } from "@/lib/auth-helpers";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getRequiredSession();

  return (
    <DashboardShell user={session.user}>{children}</DashboardShell>
  );
}
