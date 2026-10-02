import { Trophy } from "lucide-react";
import { cx } from "@/components/ui";
import { php } from "@/lib/format";
import type { LeaderboardRow } from "@/types/db";

/** Ranked commission bars. The viewer's own row is drawn in ink and labeled "You". */
export function Leaderboard({ rows, meId, showSales = true }: { rows: LeaderboardRow[]; meId?: string; showSales?: boolean }) {
  const max = Math.max(...rows.map((r) => r.commission_earned), 0);
  if (rows.length === 0) return <p className="px-5 py-6 text-sm text-graphite">No active agents yet.</p>;

  return (
    <ol className="divide-y divide-rule/70">
      {rows.map((r) => {
        const me = r.agent_id === meId;
        const width = max > 0 ? Math.max((r.commission_earned / max) * 100, r.commission_earned > 0 ? 2 : 0) : 0;
        return (
          <li key={r.agent_id} className={cx("grid grid-cols-[2.25rem_1fr] items-center gap-3 px-5 py-3", me && "bg-[#f6eedb]/60")}>
            <span
              className={cx(
                "grid size-8 place-items-center rounded-full font-display text-base font-semibold",
                r.rank === 1 && r.commission_earned > 0 ? "bg-foil text-ink" : "bg-paper-2 text-graphite",
              )}
              aria-label={`Rank ${r.rank}`}
            >
              {r.rank === 1 && r.commission_earned > 0 ? <Trophy className="size-4" aria-hidden /> : r.rank}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium">
                  {r.agent_name}
                  {me && <span className="ml-2 rounded bg-ink px-1.5 py-0.5 font-mono text-[0.6rem] tracking-wider text-paper uppercase">You</span>}
                </p>
                <p className="shrink-0 font-mono text-sm tabular">{php(r.commission_earned)}</p>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-paper-2">
                <div className={cx("h-2 rounded-full", me ? "bg-ink" : "bg-foil-dark")} style={{ width: `${width}%` }} />
              </div>
              {showSales && (
                <p className="mt-1 text-xs text-graphite">
                  {php(r.sales_booked)} booked · {r.orders_count} {r.orders_count === 1 ? "order" : "orders"} · {r.referrals_count}{" "}
                  {r.referrals_count === 1 ? "referral" : "referrals"}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
