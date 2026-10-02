import { Trash2 } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, StatTile, Table, Td, Th, buttonStyles, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deletePayout } from "@/lib/actions/admin";
import { fmtDate, fmtMonth, monthStart, php, todayISO } from "@/lib/format";
import { getAgents, getCommissionEarnings, getOrders, getPayouts } from "@/lib/queries";
import { PayoutForm } from "./payout-form";

export const metadata = { title: "Commissions" };

export default async function CommissionsPage() {
  const today = todayISO();
  const thisMonth = monthStart(today);
  const [agents, earnings, payouts, openOrders] = await Promise.all([
    getAgents(),
    getCommissionEarnings(),
    getPayouts(),
    getOrders({}),
  ]);

  const rows = agents.map((a) => {
    const mine = earnings.filter((e) => e.agent_id === a.id);
    const earned = mine.reduce((s, e) => s + e.commission, 0);
    const month = mine.filter((e) => e.paid_on >= thisMonth).reduce((s, e) => s + e.commission, 0);
    const paid = payouts.filter((p) => p.agent_id === a.id).reduce((s, p) => s + p.amount, 0);
    const pending = openOrders.filter((o) => o.agent_id === a.id).reduce((s, o) => s + o.commission_pending, 0);
    return { id: a.id, name: a.full_name, earned, month, paid, owed: earned - paid, pending };
  });
  const totals = rows.reduce(
    (t, r) => ({ earned: t.earned + r.earned, paid: t.paid + r.paid, owed: t.owed + r.owed, pending: t.pending + r.pending }),
    { earned: 0, paid: 0, owed: 0, pending: 0 },
  );

  // Earned per month for the last 6 months, per agent
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(`${thisMonth}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  return (
    <>
      <PageHeader title="Commissions" description="Agents earn their rate on every payment a referred client makes." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Owed to agents" value={php(totals.owed)} emphasis />
        <StatTile label="Earned, all time" value={php(totals.earned)} />
        <StatTile label="Paid out" value={php(totals.paid)} />
        <StatTile label="Pending" value={php(totals.pending)} hint="If open balances get paid" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Balance by agent" />
            <Table>
              <thead>
                <tr>
                  <Th>Agent</Th>
                  <Th className="text-right">This month</Th>
                  <Th className="text-right">Earned</Th>
                  <Th className="text-right">Paid out</Th>
                  <Th className="text-right">Owed</Th>
                  <Th className="text-right">Pending</Th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-medium">{r.name}</Td>
                    <Td className="text-right font-mono">{php(r.month)}</Td>
                    <Td className="text-right font-mono">{php(r.earned)}</Td>
                    <Td className="text-right font-mono">{php(r.paid)}</Td>
                    <Td className={cx("text-right font-mono", r.owed > 0 && "font-semibold")}>{php(r.owed)}</Td>
                    <Td className="text-right font-mono text-graphite">{php(r.pending)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Earned by month" description="Based on the date each payment was received" />
            <Table>
              <thead>
                <tr>
                  <Th>Agent</Th>
                  {months.map((m) => (
                    <Th key={m} className="text-right">
                      {fmtMonth(`${m}-01`).replace(/ \d{4}$/, "")}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {agents.map((a) => (
                  <tr key={a.id}>
                    <Td className="font-medium">{a.full_name}</Td>
                    {months.map((m) => {
                      const v = earnings.filter((e) => e.agent_id === a.id && e.paid_on.startsWith(m)).reduce((s, e) => s + e.commission, 0);
                      return (
                        <Td key={m} className={cx("text-right font-mono", !v && "text-graphite/50")}>
                          {v ? php(v) : "—"}
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Payout history" />
            {payouts.length === 0 ? (
              <EmptyState title="No payouts recorded" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Agent</Th>
                    <Th>Covers</Th>
                    <Th className="text-right">Amount</Th>
                    <Th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <Td>{fmtDate(p.paid_on)}</Td>
                      <Td>{p.agent_name}</Td>
                      <Td className="text-graphite">{p.period_label ?? "—"}</Td>
                      <Td className="text-right font-mono">{php(p.amount)}</Td>
                      <Td>
                        <form action={deletePayout}>
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmButton message="Remove this payout record?" className={cx(buttonStyles.ghost, "px-2")} aria-label="Remove payout">
                            <Trash2 className="size-4" />
                          </ConfirmButton>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Record a payout" description="Log commission you've paid an agent." />
          <div className="p-5">
            <PayoutForm agents={rows.map((r) => ({ id: r.id, name: r.name, owed: r.owed }))} today={today} />
          </div>
        </Card>
      </div>
    </>
  );
}
