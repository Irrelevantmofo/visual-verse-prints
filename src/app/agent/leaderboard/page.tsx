import { Card, CardHeader, PageHeader } from "@/components/ui";
import { Tabs } from "@/components/staff/tabs";
import { Leaderboard } from "@/components/leaderboard";
import { addDays, fmtDate, fmtMonth, monthEnd, monthStart, todayISO, weekStart } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { getLeaderboard } from "@/lib/queries";

export const metadata = { title: "Leaderboard" };

const PERIODS = ["week", "month", "last-month", "year"] as const;
type Period = (typeof PERIODS)[number];

function range(period: Period, today: string) {
  switch (period) {
    case "week":
      return { from: weekStart(today), to: today, label: `This week, from ${fmtDate(weekStart(today))}` };
    case "last-month": {
      const end = addDays(monthStart(today), -1);
      return { from: monthStart(end), to: monthEnd(end), label: fmtMonth(end) };
    }
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today, label: `${today.slice(0, 4)} so far` };
    default:
      return { from: monthStart(today), to: today, label: `${fmtMonth(today)} so far` };
  }
}

export default async function AgentLeaderboard({ searchParams }: PageProps<"/agent/leaderboard">) {
  const me = await requireRole("agent");
  const { period: p } = await searchParams;
  const period: Period = PERIODS.includes(p as Period) ? (p as Period) : "month";
  const today = todayISO();
  const { from, to, label } = range(period, today);
  const rows = await getLeaderboard(from, to);
  const mine = rows.find((r) => r.agent_id === me.id);
  const leader = rows[0];

  return (
    <>
      <PageHeader title="Leaderboard" description="Ranked by commission earned from client payments." />
      <Tabs
        active={period}
        items={[
          { key: "week", label: "This week", href: "/agent/leaderboard?period=week" },
          { key: "month", label: "This month", href: "/agent/leaderboard" },
          { key: "last-month", label: "Last month", href: "/agent/leaderboard?period=last-month" },
          { key: "year", label: "This year", href: "/agent/leaderboard?period=year" },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <CardHeader title={label} />
          <Leaderboard rows={rows} meId={me.id} />
        </Card>
        {mine && (
          <aside className="h-fit rounded-lg bg-ink p-5 text-paper">
            <p className="font-mono text-[0.68rem] tracking-[0.3em] text-foil-light uppercase">Your rank</p>
            <p className="mt-2 font-display text-6xl font-bold">
              #{mine.rank}
              <span className="ml-2 text-2xl text-paper/50">of {rows.length}</span>
            </p>
            <p className="mt-3 text-sm text-paper/75">
              {mine.rank === 1 && mine.commission_earned > 0
                ? "You're leading the team. Nice work."
                : leader && leader.commission_earned > mine.commission_earned
                  ? `${leader.agent_name} leads. Every referral that turns into a paid order moves you up.`
                  : "Everyone's even so far. One paid referral puts you on top."}
            </p>
          </aside>
        )}
      </div>
    </>
  );
}
