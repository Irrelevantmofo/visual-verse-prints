import { StaffShell, type NavItem } from "@/components/staff-shell";
import { requireRole } from "@/lib/auth";
import { countPendingReferrals } from "@/lib/queries";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireRole("admin");
  const pending = await countPendingReferrals();

  const nav: NavItem[] = [
    { href: "/admin", label: "Daily dashboard", icon: "dashboard", exact: true },
    { href: "/admin/referrals", label: "Referrals", icon: "referrals", badge: pending },
    { href: "/admin/quotations", label: "Quotations", icon: "quotations" },
    { href: "/admin/orders", label: "Orders", icon: "orders" },
    { href: "/admin/performance", label: "Performance", icon: "performance" },
    { href: "/admin/agents", label: "Agents", icon: "agents" },
    { href: "/admin/commissions", label: "Commissions", icon: "commissions" },
    { href: "/admin/catalog", label: "Catalog", icon: "catalog" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
  ];

  return (
    <StaffShell nav={nav} user={{ name: profile.full_name, email: profile.email }} roleLabel="Admin" accountHref="/admin/account">
      {children}
    </StaffShell>
  );
}
