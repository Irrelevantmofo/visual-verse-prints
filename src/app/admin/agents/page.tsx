import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { monthStart, pct, php, todayISO } from "@/lib/format";
import { getAgents, getLeaderboard, getSettings } from "@/lib/queries";
import { EditAgentForm, NewAgentForm, ResetPasswordForm } from "./agent-forms";

export const metadata = { title: "Agents" };

export default async function AgentsPage() {
  const today = todayISO();
  const [agents, settings, board] = await Promise.all([getAgents(), getSettings(), getLeaderboard(monthStart(today), today)]);
  const stats = new Map(board.map((r) => [r.agent_id, r]));

  return (
    <>
      <PageHeader title="Agents" description={`Commission is set per product on each order. An agent's rate below is used for products without their own rate (shop default ${pct(settings.default_commission_rate)}).`} />

      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <Card>
          <CardHeader title="Team" description="This month's figures shown per agent" />
          {agents.length === 0 ? (
            <EmptyState title="No agents yet">Add your first agent with the form.</EmptyState>
          ) : (
            <ul className="divide-y divide-rule">
              {agents.map((a) => {
                const s = stats.get(a.id);
                return (
                  <li key={a.id} className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {a.full_name || "Unnamed"}{" "}
                          {!a.active && (
                            <span className="ml-1">
                              <Badge tone="red">Inactive</Badge>
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-graphite">
                          {a.email} · {a.commission_rate != null ? `${pct(a.commission_rate)} fallback rate` : `shop default (${pct(settings.default_commission_rate)})`}
                        </p>
                      </div>
                      {s && (
                        <p className="text-right text-xs text-graphite">
                          <span className="font-mono text-sm text-ink">{php(s.commission_earned)}</span> earned ·{" "}
                          <span className="font-mono">{php(s.sales_booked)}</span> booked · {s.referrals_count} referrals
                        </p>
                      )}
                    </div>
                    <EditAgentForm agent={a} />
                    <details className="text-sm">
                      <summary className="cursor-pointer text-graphite hover:text-ink">Reset password</summary>
                      <div className="mt-3">
                        <ResetPasswordForm agentId={a.id} />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Add agent" description="Creates their sign-in right away." />
          <div className="p-5">
            <NewAgentForm defaultRatePct={+(settings.default_commission_rate * 100).toFixed(2)} />
          </div>
        </Card>
      </div>
    </>
  );
}
