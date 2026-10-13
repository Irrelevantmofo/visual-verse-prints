import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatTile, Table, Td, Th, buttonStyles, cx } from "@/components/ui";
import { Tabs } from "@/components/staff/tabs";
import { fmtDate, fmtMonth, monthStart, pct, php, todayISO } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/labels";
import { requireRole } from "@/lib/auth";
import { feesByMonth, getPlatformFees, isDeveloper } from "@/lib/platform";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/db";

export const metadata = { title: "Platform fee" };

const KIND = {
  payment: { label: "Payment", tone: "green" },
  adjustment: { label: "Adjustment", tone: "amber" },
  reversal: { label: "Reversal", tone: "red" },
} as const;

export default async function PlatformFeePage({ searchParams }: PageProps<"/admin/platform">) {
  const me = await requireRole("admin");
  // Developer-only: other admins get a plain "not found"
  if (!(await isDeveloper(me.id))) notFound();

  const { month: monthParam } = await searchParams;
  const supabase = await createClient();
  const [fees, { data: webOrders }] = await Promise.all([
    getPlatformFees(),
    supabase.from("orders").select("order_status, total_amount").not("public_token", "is", null),
  ]);

  const months = feesByMonth(fees);
  const thisMonth = monthStart(todayISO()).slice(0, 7);
  const selected = typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : "all";
  const shown = selected === "all" ? fees : fees.filter((f) => f.paid_on.startsWith(selected));

  const total = fees.reduce((s, f) => s + f.fee, 0);
  const collected = fees.reduce((s, f) => s + f.payment_amount, 0);
  const monthFee = months.find((m) => m.month === thisMonth)?.fee ?? 0;
  const rate = fees[0]?.fee_rate ?? 0.01;

  const orders = webOrders ?? [];
  const byStatus = (Object.keys(ORDER_STATUS) as OrderStatus[])
    .map((s) => ({ status: s, count: orders.filter((o) => o.order_status === s).length }))
    .filter((r) => r.count > 0);

  return (
    <>
      <PageHeader
        title="Platform fee"
        description={`${pct(rate)} of every payment recorded on an order placed through the website. Only developer accounts can see this page.`}
        actions={
          <a href={`/admin/platform/export${selected === "all" ? "" : `?month=${selected}`}`} className={buttonStyles.secondary}>
            <Download className="size-4" aria-hidden /> Download CSV
          </a>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Fee this month" value={php(monthFee)} emphasis hint={fmtMonth(`${thisMonth}-01`)} />
        <StatTile label="Fee, all time" value={php(total)} />
        <StatTile label="Website payments tracked" value={php(collected)} hint="Net of deleted payments" />
        <StatTile label="Website orders placed" value={orders.length} hint={byStatus.map((r) => `${r.count} ${ORDER_STATUS[r.status].label.toLowerCase()}`).join(" · ") || "None yet"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <Card className="h-fit">
          <CardHeader title="By month" description="By the date each payment was received" />
          {months.length === 0 ? (
            <EmptyState title="No fees yet">Fees appear when a payment is recorded on a website order.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Month</Th>
                  <Th className="text-right">Payments</Th>
                  <Th className="text-right">Fee</Th>
                </tr>
              </thead>
              <tbody className="tabular">
                {months.map((m) => (
                  <tr key={m.month} className={cx(selected === m.month && "bg-[#f6eedb]/50")}>
                    <Td>
                      <Link href={`/admin/platform?month=${m.month}`} className="font-medium hover:underline">
                        {fmtMonth(`${m.month}-01`)}
                      </Link>
                      {m.reversed > 0 && <p className="text-xs text-rose-700">{php(m.reversed)} reversed</p>}
                    </Td>
                    <Td className="text-right font-mono">{php(m.collected)}</Td>
                    <Td className="text-right font-mono font-medium">{php(m.fee)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div>
          <Tabs
            active={selected}
            items={[
              { key: "all", label: "All entries", href: "/admin/platform", count: fees.length },
              ...months.slice(0, 5).map((m) => ({
                key: m.month,
                label: fmtMonth(`${m.month}-01`),
                href: `/admin/platform?month=${m.month}`,
              })),
            ]}
          />
          <Card>
            <CardHeader
              title="Ledger"
              description="Written automatically and never edited. A deleted payment or order shows as a reversal instead of disappearing."
            />
            {shown.length === 0 ? (
              <EmptyState title="Nothing recorded">No payments on website orders {selected === "all" ? "yet" : "in this month"}.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Paid on</Th>
                    <Th>Order</Th>
                    <Th>Entry</Th>
                    <Th className="text-right">Payment</Th>
                    <Th className="text-right">Fee</Th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {shown.slice(0, 300).map((f) => (
                    <tr key={f.id}>
                      <Td className="whitespace-nowrap">{fmtDate(f.paid_on)}</Td>
                      <Td>
                        <span className="font-medium">#{f.order_no ?? "—"}</span> {f.client_name}
                        {f.note && <p className="text-xs text-graphite">{f.note}</p>}
                      </Td>
                      <Td>
                        <Badge tone={KIND[f.kind].tone}>{KIND[f.kind].label}</Badge>
                      </Td>
                      <Td className={cx("text-right font-mono", f.payment_amount < 0 && "text-rose-700")}>{php(f.payment_amount)}</Td>
                      <Td className={cx("text-right font-mono font-medium", f.fee < 0 && "text-rose-700")}>{php(f.fee)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {shown.length > 300 && <p className="border-t border-rule px-5 py-3 text-xs text-graphite">Showing the latest 300. Download the CSV for all {shown.length}.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
