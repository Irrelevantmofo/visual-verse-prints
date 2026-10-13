"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Menu,
  X,
  LogOut,
  KeyRound,
  LayoutDashboard,
  Inbox,
  FileText,
  Package,
  TrendingUp,
  Users,
  Wallet,
  BookOpen,
  Settings,
  Trophy,
  Send,
  ReceiptText,
  Percent,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  dashboard: LayoutDashboard,
  referrals: Inbox,
  quotations: FileText,
  orders: Package,
  performance: TrendingUp,
  agents: Users,
  commissions: Wallet,
  catalog: BookOpen,
  settings: Settings,
  leaderboard: Trophy,
  submit: Send,
  payments: ReceiptText,
  platform: Percent,
} satisfies Record<string, LucideIcon>;
import { Wordmark } from "@/components/logo";
import { cx } from "@/components/ui";
import { signOut } from "@/lib/actions/auth";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; exact?: boolean };

export function StaffShell({
  nav,
  user,
  roleLabel,
  accountHref,
  children,
}: {
  nav: NavItem[];
  user: { name: string; email: string | null };
  roleLabel: string;
  accountHref: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const matches = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
  // The most specific matching item wins (e.g. "Refer a client" over "My referrals").
  const isActive = (item: NavItem) =>
    matches(item) && !nav.some((other) => other !== item && other.href.length > item.href.length && matches(other));

  const sidebar = (
    <div className="flex h-full flex-col bg-ink text-paper/80">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href={nav[0].href} className="text-foil-light" onClick={() => setOpen(false)}>
          <Wordmark />
        </Link>
        <button className="rounded p-1 text-paper/60 hover:text-paper lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <p className="px-5 pb-3 font-mono text-[0.62rem] tracking-[0.3em] text-foil/80 uppercase">{roleLabel}</p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {nav.map((item) => {
          const active = isActive(item);
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-ink-3 text-paper" : "hover:bg-ink-2 hover:text-paper",
              )}
            >
              <span className={cx("h-4 w-0.5 rounded-full", active ? "bg-foil" : "bg-transparent")} aria-hidden />
              <Icon className={cx("size-4", active ? "text-foil-light" : "text-paper/50 group-hover:text-paper/80")} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-foil px-1.5 py-0.5 font-mono text-[0.65rem] leading-none text-ink">{item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-paper/10 p-4">
        <p className="truncate text-sm font-medium text-paper">{user.name || "Unnamed"}</p>
        <p className="truncate text-xs text-paper/50">{user.email}</p>
        <div className="mt-3 flex gap-2">
          <Link
            href={accountHref}
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-paper/70 hover:bg-ink-2 hover:text-paper"
          >
            <KeyRound className="size-3.5" aria-hidden /> Password
          </Link>
          <form action={signOut}>
            <button className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-paper/70 hover:bg-ink-2 hover:text-paper">
              <LogOut className="size-3.5" aria-hidden /> Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} aria-hidden />
          <aside className="relative h-full w-72 max-w-[85vw]">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded p-1.5 hover:bg-paper-2" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <span className="font-serif text-sm font-semibold tracking-[0.18em] uppercase">Visual Verse</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
