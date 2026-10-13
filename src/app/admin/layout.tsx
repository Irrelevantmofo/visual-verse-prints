import { StaffShell, type NavItem } from "@/components/staff-shell";
import { requireRole } from "@/lib/auth";
import { isDeveloper } from "@/lib/platform";
import { countOrdersToPrice, countPendingProofs, countPendingReferrals, getWebOrderAlerts } from "@/lib/queries";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireRole("admin");
  const [pending, toPrice, toVerify, alerts] = await Promise.all([
    countPendingReferrals(),
    countOrdersToPrice(),
    countPendingProofs(),
    getWebOrderAlerts(),
  ]);
  // Orders waiting on a price, plus any other website order with customer activity nobody has opened yet
  const orderBadge = toPrice + alerts.filter((a) => a.order_status !== "pending_review").length;

  const nav: NavItem[] = [
    { href: "/admin", label: "Daily dashboard", icon: "dashboard", exact: true },
    { href: "/admin/referrals", label: "Referrals", icon: "referrals", badge: pending },
    { href: "/admin/quotations", label: "Quotations", icon: "quotations" },
    { href: "/admin/orders", label: "Orders", icon: "orders", badge: orderBadge },
    { href: "/admin/payments", label: "Payments to verify", icon: "payments", badge: toVerify },
    { href: "/admin/performance", label: "Performance", icon: "performance" },
    { href: "/admin/agents", label: "Agents", icon: "agents" },
    { href: "/admin/commissions", label: "Commissions", icon: "commissions" },
    { href: "/admin/catalog", label: "Catalog", icon: "catalog" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
  ];
  // Only developer accounts get the platform fee report
  if (await isDeveloper(profile.id)) nav.push({ href: "/admin/platform", label: "Platform fee", icon: "platform" });

  return (
    <StaffShell nav={nav} user={{ name: profile.full_name, email: profile.email }} roleLabel="Admin" accountHref="/admin/account">
      {children}
    </StaffShell>
  );
}
