import { StaffShell, type NavItem } from "@/components/staff-shell";
import { requireRole } from "@/lib/auth";

export default async function AgentLayout({ children }: LayoutProps<"/agent">) {
  const profile = await requireRole("agent");

  const nav: NavItem[] = [
    { href: "/agent", label: "Overview", icon: "dashboard", exact: true },
    { href: "/agent/referrals", label: "My referrals", icon: "referrals" },
    { href: "/agent/referrals/new", label: "Refer a client", icon: "submit", exact: true },
    { href: "/agent/leaderboard", label: "Leaderboard", icon: "leaderboard" },
    { href: "/agent/earnings", label: "Earnings", icon: "commissions" },
  ];

  return (
    <StaffShell nav={nav} user={{ name: profile.full_name, email: profile.email }} roleLabel="Agent" accountHref="/agent/account">
      {children}
    </StaffShell>
  );
}
