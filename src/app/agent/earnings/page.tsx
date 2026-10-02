import { Card, CardHeader, EmptyState, PageHeader, StatTile, Table, Td, Th } from "@/components/ui";
import { fmtDate, fmtMonth, pct, php } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { getCommissionEarnings, getOrders, getPayouts } from "@/lib/queries";

export const metadata = { title: "Earnings" };

export default async function AgentEarnings() {
  const me = await requireRole("agent");
  const [earnings, payouts, orders] = await Promise.all([
    getCommissionEarnings({ agentId: me.id }),
    getPayouts({ agentId: me.id }),
    getOrders({ agentId: me.id }),
  ]);

  const earned = earnings.reduce((s, e) => s + e.commission, 0);
  const paid = payouts.reduce((s, p) => s + p.amount, 0);
  const pending = orders.reduce((s, o) => s + o.commission_pending, 0);

  const byMonth = new Map<string, { collected: number; commission: number }>();
  for (const e of earnings) {
    const m = e.paid_on.slice(0, 7);
    const cur = byMonth.get(m) ?? { collected: 0, commission: 0 };
    byMonth.set(m, { collected: cur.collected + e.payment_amount, commission: cur.commission + e.commission });
  }
  const months = [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a));

  return (
    <>
      <PageHeader
        title="Earnings"
        description="Commission is set per product on each order. You earn it as your referred clients pay."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Not yet paid to you" value={php(Math.max(earned - paid, 0))} emphasis />
        <StatTile label="Earned, all time" value={php(earned)} />
        <StatTile label="Paid to you" value={php(paid)} />
        <StatTile label="Waiting on payment" value={php(pending)} hint="From balances clients still owe" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="By month" />
          {months.length === 0 ? (
            <EmptyState title="No commission yet">You earn commission as soon as a referred client makes a payment.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Month</Th>
                  <Th className="text-right">Client payments</Th>
                  <Th className="text-right">Commission</Th>
                </tr>
              </thead>
              <tbody className="tabular">
                {months.map(([m, v]) => (
                  <tr key={m}>
                    <Td>{fmtMonth(`${m}-01`)}</Td>
                    <Td className="text-right font-mono">{php(v.collected)}</Td>
                    <Td className="text-right font-mono font-medium">{php(v.commission)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Payouts received" />
          {payouts.length === 0 ? (
            <EmptyState title="No payouts yet">Payouts from the shop are listed here.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Covers</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <Td>{fmtDate(p.paid_on)}</Td>
                    <Td className="text-graphite">{p.period_label ?? "—"}</Td>
                    <Td className="text-right font-mono">{php(p.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Every payment" description="Each client payment and the commission it earned you" />
          {earnings.length === 0 ? (
            <EmptyState title="Nothing yet" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date paid</Th>
                  <Th>Client</Th>
                  <Th>Order</Th>
                  <Th className="text-right">Payment</Th>
                  <Th className="text-right">Rate</Th>
                  <Th className="text-right">Commission</Th>
                </tr>
              </thead>
              <tbody className="tabular">
                {earnings.map((e) => (
                  <tr key={e.payment_id}>
                    <Td>{fmtDate(e.paid_on)}</Td>
                    <Td>{e.client_name}</Td>
                    <Td className="font-mono text-xs text-graphite">#{e.order_no}</Td>
                    <Td className="text-right font-mono">{php(e.payment_amount)}</Td>
                    <Td className="text-right font-mono text-graphite">{pct(e.commission_rate)}</Td>
                    <Td className="text-right font-mono font-medium">{php(e.commission)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
