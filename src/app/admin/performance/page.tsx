import { Card, CardHeader, PageHeader, StatTile, Table, Td, Th } from "@/components/ui";
import { DateNav } from "@/components/staff/date-nav";
import { DailySalesChart } from "@/components/charts/daily-sales-chart";
import { Leaderboard } from "@/components/leaderboard";
import { addDays, fmtDate, fmtDateShort, fmtMonth, isISODate, php, todayISO } from "@/lib/format";
import { getAgents, getLeaderboard, getOrders, getQuotations, periodBounds, sumOrders } from "@/lib/queries";
import type { OrderSummary, Profile, QuotationSummary } from "@/types/db";

export const metadata = { title: "Performance" };

function periodRows(agents: Profile[], orders: OrderSummary[], quotes: QuotationSummary[], from: string, to: string) {
  const inOrders = orders.filter((o) => o.order_date >= from && o.order_date <= to);
  const inQuotes = quotes.filter((q) => q.date_sent >= from && q.date_sent <= to && q.status === "pending");
  const rows = agents.map((a) => ({
    id: a.id,
    name: a.full_name,
    ...sumOrders(inOrders.filter((o) => o.agent_id === a.id)),
    pipeline: inQuotes.filter((q) => q.agent_id === a.id).reduce((s, q) => s + q.quoted_amount, 0),
  }));
  const top = rows.reduce<(typeof rows)[number] | null>((best, r) => (r.booked > (best?.booked ?? 0) ? r : best), null);
  return { rows, top, totals: sumOrders(inOrders) };
}

function PeriodTable({ title, from, to, data }: { title: string; from: string; to: string; data: ReturnType<typeof periodRows> }) {
  return (
    <Card>
      <CardHeader
        title={title}
        description={`${fmtDateShort(from)} – ${fmtDate(to)}`}
        action={
          data.top ? (
            <p className="text-right text-xs text-graphite">
              Top seller
              <span className="block font-display text-lg font-semibold text-ink uppercase">{data.top.name}</span>
            </p>
          ) : null
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Agent</Th>
            <Th className="text-right">Sales booked</Th>
            <Th className="text-right">Orders</Th>
            <Th className="text-right">Collected</Th>
            <Th className="text-right">Balance</Th>
            <Th className="text-right">Quote pipeline</Th>
          </tr>
        </thead>
        <tbody className="tabular">
          {data.rows.map((r) => (
            <tr key={r.id} className={r.id === data.top?.id ? "bg-[#f6eedb]/50" : undefined}>
              <Td className="font-medium">{r.name}</Td>
              <Td className="text-right font-mono">{php(r.booked)}</Td>
              <Td className="text-right">{r.count}</Td>
              <Td className="text-right font-mono">{php(r.collected)}</Td>
              <Td className="text-right font-mono">{php(r.balance)}</Td>
              <Td className="text-right font-mono">{php(r.pipeline)}</Td>
            </tr>
          ))}
          <tr className="font-medium">
            <Td>All orders</Td>
            <Td className="text-right font-mono">{php(data.totals.booked)}</Td>
            <Td className="text-right">{data.totals.count}</Td>
            <Td className="text-right font-mono">{php(data.totals.collected)}</Td>
            <Td className="text-right font-mono">{php(data.totals.balance)}</Td>
            <Td />
          </tr>
        </tbody>
      </Table>
    </Card>
  );
}

export default async function PerformancePage({ searchParams }: PageProps<"/admin/performance">) {
  const { date: d } = await searchParams;
  const today = todayISO();
  const asOf = isISODate(d) ? d : today;
  const { weekFrom, monthFrom } = periodBounds(asOf);
  const from = weekFrom < monthFrom ? weekFrom : monthFrom;

  const [agents, orders, quotes, board] = await Promise.all([
    getAgents(),
    getOrders({ from, to: asOf }),
    getQuotations({ from, to: asOf }),
    getLeaderboard(monthFrom, asOf),
  ]);
  const week = periodRows(agents, orders, quotes, weekFrom, asOf);
  const month = periodRows(agents, orders, quotes, monthFrom, asOf);

  const daily = [];
  for (let day = monthFrom; day <= asOf; day = addDays(day, 1)) {
    const dayOrders = orders.filter((o) => o.order_date === day && o.order_status !== "cancelled");
    daily.push({ date: day, label: fmtDate(day), booked: dayOrders.reduce((s, o) => s + o.total_amount, 0), orders: dayOrders.length });
  }

  return (
    <>
      <PageHeader title="Performance" description={`Week-to-date and month-to-date as of ${fmtDate(asOf)}`} actions={<DateNav value={asOf} today={today} label="As-of date" />} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Week sales booked" value={php(week.totals.booked)} hint={`${week.totals.count} orders`} />
        <StatTile label="Month sales booked" value={php(month.totals.booked)} hint={`${month.totals.count} orders`} emphasis />
        <StatTile label="Month collected" value={php(month.totals.collected)} />
        <StatTile label="Month outstanding" value={php(month.totals.balance)} />
      </div>

      <Card className="mb-6">
        <CardHeader title="Sales booked per day" description={fmtMonth(asOf)} />
        <div className="p-4">
          <DailySalesChart data={daily} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <PeriodTable title="This week" from={weekFrom} to={asOf} data={week} />
          <PeriodTable title="This month" from={monthFrom} to={asOf} data={month} />
        </div>
        <Card className="h-fit">
          <CardHeader title="Commission leaderboard" description="Month to date · what agents see" />
          <Leaderboard rows={board} />
        </Card>
      </div>
    </>
  );
}
