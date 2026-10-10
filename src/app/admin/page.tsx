import Link from "next/link";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatTile, Table, Td, Th } from "@/components/ui";
import { DateNav } from "@/components/staff/date-nav";
import { addDays, fmtDate, fmtDateShort, isISODate, num, php, todayISO } from "@/lib/format";
import { FOLLOW_UP_FLAG, ORDER_STATUS, PAYMENT_STATUS, type FollowUpFlag } from "@/lib/labels";
import { byAgent, flagCounts, getAgents, getOrders, getQuotations, getReferrals, getSettings, openPipeline, sumOrders, getWebOrderAlerts } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Daily dashboard" };

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const { date: dateParam } = await searchParams;
  const today = todayISO();
  const date = isISODate(dateParam) ? dateParam : today;

  const supabase = await createClient();
  const [settings, agents, orders, quotes, pendingReferrals, paymentsRes, webAlerts] = await Promise.all([
    getSettings(),
    getAgents(),
    getOrders({ from: date, to: date }),
    getQuotations({ from: addDays(date, -180), to: date }),
    getReferrals({ status: "submitted", limit: 6 }),
    supabase.from("payments").select("amount").eq("paid_on", date),
    getWebOrderAlerts(),
  ]);

  const totals = sumOrders(orders);
  const newQuotes = quotes.filter((q) => q.date_sent === date);
  const pipeline = openPipeline(quotes, date);
  const flags = flagCounts(quotes, date, settings.due_soon_days);
  const agentRows = byAgent(agents, orders, quotes, date);
  const directOrders = orders.filter((o) => !o.agent_id);
  const receivedToday = (paymentsRes.data ?? []).reduce((s, p) => s + num(p.amount), 0);

  const statusCounts = (["in_progress", "ready", "delivered", "cancelled"] as const).map((s) => ({
    status: s,
    count: orders.filter((o) => o.order_status === s).length,
  }));

  return (
    <>
      <PageHeader
        title="Daily dashboard"
        description={`Orders and quotations for ${fmtDate(date)}`}
        actions={<DateNav value={date} today={today} />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Confirmed orders" value={totals.count} />
        <StatTile label="Sales booked" value={php(totals.booked)} emphasis />
        <StatTile label="Amount collected" value={php(totals.collected)} hint="On this day's orders" />
        <StatTile label="Outstanding" value={php(totals.balance)} />
        <StatTile label="New quotations" value={newQuotes.length} hint={php(newQuotes.reduce((s, q) => s + q.quoted_amount, 0))} />
        <StatTile label="Open quote pipeline" value={php(pipeline.value)} hint={`${pipeline.count} open, not expired`} />
      </div>
      <p className="mt-2 text-xs text-graphite">
        Payments received on {fmtDateShort(date)} across all orders: <span className="font-mono">{php(receivedToday)}</span>
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader title="By agent" description="Orders booked on this date, and each agent's open quotes" />
          <Table>
            <thead>
              <tr>
                <Th>Agent</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">Sales booked</Th>
                <Th className="text-right">Collected</Th>
                <Th className="text-right">Balance</Th>
                <Th className="text-right">Open quotes</Th>
                <Th className="text-right">Quote pipeline</Th>
              </tr>
            </thead>
            <tbody className="tabular">
              {agentRows.map((r) => (
                <tr key={r.agentId}>
                  <Td className="font-medium">{r.name}</Td>
                  <Td className="text-right">{r.totals.count}</Td>
                  <Td className="text-right">{php(r.totals.booked)}</Td>
                  <Td className="text-right">{php(r.totals.collected)}</Td>
                  <Td className="text-right">{php(r.totals.balance)}</Td>
                  <Td className="text-right">{r.openQuotes}</Td>
                  <Td className="text-right">{php(r.pipeline)}</Td>
                </tr>
              ))}
              {directOrders.length > 0 && (
                <tr className="text-graphite">
                  <Td>Direct / website</Td>
                  <Td className="text-right">{directOrders.length}</Td>
                  <Td className="text-right">{php(sumOrders(directOrders).booked)}</Td>
                  <Td className="text-right">{php(sumOrders(directOrders).collected)}</Td>
                  <Td className="text-right">{php(sumOrders(directOrders).balance)}</Td>
                  <Td className="text-right">—</Td>
                  <Td className="text-right">—</Td>
                </tr>
              )}
              {agentRows.length === 0 && (
                <tr>
                  <Td colSpan={7} className="text-center text-graphite">
                    No agents yet. <Link href="/admin/agents" className="underline">Add one</Link>.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Production" />
            <ul className="divide-y divide-rule/70 text-sm">
              {statusCounts.map(({ status, count }) => (
                <li key={status} className="flex items-center justify-between px-5 py-2.5">
                  <Badge tone={ORDER_STATUS[status].tone}>{ORDER_STATUS[status].label}</Badge>
                  <span className="font-mono">{count}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Quote follow-ups" description={`Open quotes as of ${fmtDateShort(date)}`} />
            <ul className="divide-y divide-rule/70 text-sm">
              {(Object.keys(flags) as FollowUpFlag[]).map((f) => (
                <li key={f} className="flex items-center justify-between px-5 py-2.5">
                  <Badge tone={FOLLOW_UP_FLAG[f].tone}>{FOLLOW_UP_FLAG[f].label}</Badge>
                  <span className="font-mono">{flags[f]}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader
            title="Orders on this date"
            action={<ButtonLink href={`/admin/orders/new?date=${date}`} variant="secondary">New order</ButtonLink>}
          />
          {orders.length === 0 ? (
            <EmptyState title="No orders on this date">Orders you record for {fmtDate(date)} appear here.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Agent</Th>
                  <Th>Items</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-paper">
                    <Td>
                      <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                        {o.client_name}
                      </Link>
                    </Td>
                    <Td>{o.agent_name ?? <span className="text-graphite">Direct</span>}</Td>
                    <Td className="max-w-xs text-graphite">{o.items}</Td>
                    <Td className="text-right font-mono tabular">{php(o.total_amount)}</Td>
                    <Td>
                      <Badge tone={PAYMENT_STATUS[o.payment_status].tone}>{PAYMENT_STATUS[o.payment_status].label}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={ORDER_STATUS[o.order_status].tone}>{ORDER_STATUS[o.order_status].label}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-6">
        {webAlerts.length > 0 && (
          <Card className="border-foil/60">
            <CardHeader title="Website orders" description="New orders, artwork or receipts from customers" />
            <ul className="divide-y divide-rule/70">
              {webAlerts.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/orders/${a.id}`} className="block px-5 py-3 hover:bg-paper">
                    <p className="flex items-center justify-between gap-2 text-sm font-medium">
                      <span className="truncate">
                        #{a.order_no} · {a.client_name}
                      </span>
                      <Badge tone={a.isNew ? "gold" : "blue"}>{a.isNew ? "New order" : "New activity"}</Badge>
                    </p>
                    <p className="text-xs text-graphite">
                      {ORDER_STATUS[a.order_status].label} · {fmtDateShort(a.customer_activity_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card>
          <CardHeader title="Awaiting review" description="Referrals agents submitted" />
          {pendingReferrals.length === 0 ? (
            <p className="px-5 py-6 text-sm text-graphite">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y divide-rule/70">
              {pendingReferrals.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/referrals/${r.id}`} className="block px-5 py-3 hover:bg-paper">
                    <p className="text-sm font-medium">{r.client_name}</p>
                    <p className="text-xs text-graphite">
                      from {r.agent_name} · {fmtDateShort(r.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </div>
      </div>
    </>
  );
}
