import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th, inputStyles, buttonStyles, cx } from "@/components/ui";
import { Tabs } from "@/components/staff/tabs";
import { fmtDateShort, fmtMonth, monthEnd, monthStart, php, todayISO } from "@/lib/format";
import { isBookedOrder, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/labels";
import { getAgents, getOrders, sumOrders } from "@/lib/queries";

export const metadata = { title: "Orders" };

const FILTERS = ["all", "pending_review", "awaiting_payment", "in_progress", "ready", "delivered", "unpaid", "cancelled"] as const;
type Filter = (typeof FILTERS)[number];

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const filter: Filter = FILTERS.includes(sp.status as Filter) ? (sp.status as Filter) : "all";
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : todayISO().slice(0, 7);
  const agentId = typeof sp.agent === "string" && sp.agent ? sp.agent : undefined;
  const from = monthStart(`${month}-01`);
  const to = monthEnd(from);

  // Website orders waiting on pricing or payment are shown whatever month they were placed in, so none get missed
  const [monthOrders, waiting, agents] = await Promise.all([
    getOrders({ from, to, agentId }),
    Promise.all([getOrders({ status: "pending_review", agentId }), getOrders({ status: "awaiting_payment", agentId })]).then((r) => r.flat()),
    getAgents(),
  ]);
  const all = [...monthOrders, ...waiting.filter((w) => !monthOrders.some((m) => m.id === w.id))];
  const match = (f: Filter) => (o: (typeof all)[number]) =>
    f === "all" ? true : f === "unpaid" ? o.balance > 0 && isBookedOrder(o.order_status) : o.order_status === f;
  const orders = all.filter(match(filter));
  const totals = sumOrders(orders);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { month, agent: agentId, status: filter === "all" ? undefined : filter, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/orders?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${fmtMonth(from)} · ${totals.count} orders · ${php(totals.booked)} booked · ${php(totals.balance)} outstanding`}
        actions={<ButtonLink href="/admin/orders/new">New order</ButtonLink>}
      />

      <form className="mb-4 flex flex-wrap items-end gap-3" action="/admin/orders">
        <div>
          <label htmlFor="month" className="mb-1 block text-xs text-graphite">
            Month
          </label>
          <input id="month" name="month" type="month" defaultValue={month} className={cx(inputStyles, "w-auto font-mono")} />
        </div>
        <div>
          <label htmlFor="agent" className="mb-1 block text-xs text-graphite">
            Agent
          </label>
          <select id="agent" name="agent" defaultValue={agentId ?? ""} className={cx(inputStyles, "w-auto")}>
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </div>
        {filter !== "all" && <input type="hidden" name="status" value={filter} />}
        <button className={buttonStyles.secondary}>Apply</button>
      </form>

      <Tabs
        active={filter}
        items={[
          { key: "all", label: "All", href: qs({ status: undefined }), count: all.length },
          { key: "pending_review", label: "Needs pricing", href: qs({ status: "pending_review" }), count: all.filter(match("pending_review")).length },
          { key: "awaiting_payment", label: "Awaiting payment", href: qs({ status: "awaiting_payment" }), count: all.filter(match("awaiting_payment")).length },
          { key: "in_progress", label: "In progress", href: qs({ status: "in_progress" }), count: all.filter(match("in_progress")).length },
          { key: "ready", label: "Ready", href: qs({ status: "ready" }), count: all.filter(match("ready")).length },
          { key: "delivered", label: "Delivered", href: qs({ status: "delivered" }), count: all.filter(match("delivered")).length },
          { key: "unpaid", label: "With balance", href: qs({ status: "unpaid" }), count: all.filter(match("unpaid")).length },
          { key: "cancelled", label: "Cancelled", href: qs({ status: "cancelled" }), count: all.filter(match("cancelled")).length },
        ]}
      />

      <Card>
        {orders.length === 0 ? (
          <EmptyState title="No orders match">Try another month or filter, or record a new order.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Client</Th>
                <Th>Agent</Th>
                <Th>Items</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Paid</Th>
                <Th className="text-right">Balance</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="tabular">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-paper">
                  <Td className="whitespace-nowrap">{fmtDateShort(o.order_date)}</Td>
                  <Td>
                    <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                      {o.client_name}
                    </Link>
                    <p className="font-mono text-[0.68rem] text-graphite">#{o.order_no}</p>
                  </Td>
                  <Td>{o.agent_name ?? <span className="text-graphite">{o.source === "website" ? "Website" : "Direct"}</span>}</Td>
                  <Td className="max-w-[16rem] text-graphite">{o.items}</Td>
                  <Td className="text-right font-mono">{php(o.total_amount)}</Td>
                  <Td className="text-right font-mono">{php(o.paid_amount)}</Td>
                  <Td className="text-right font-mono">{o.balance > 0 ? php(o.balance) : "—"}</Td>
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
    </>
  );
}
