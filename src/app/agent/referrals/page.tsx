import Link from "next/link";
import { Send } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { Tabs } from "@/components/staff/tabs";
import { ReferralProgress } from "@/components/referral-progress";
import { fmtDateShort, php } from "@/lib/format";
import { REFERRAL_STAGE } from "@/lib/labels";
import { requireRole } from "@/lib/auth";
import { getReferrals } from "@/lib/queries";
import type { ReferralSummary } from "@/types/db";

export const metadata = { title: "My referrals" };

const FILTERS = {
  all: { label: "All", test: () => true },
  active: {
    label: "In progress",
    test: (r: ReferralSummary) => ["submitted", "approved", "quoted", "in_production", "ready"].includes(r.stage),
  },
  delivered: { label: "Delivered", test: (r: ReferralSummary) => r.stage === "delivered" },
  closed: { label: "Closed", test: (r: ReferralSummary) => r.stage === "lost" || r.stage === "rejected" },
} as const;
type Filter = keyof typeof FILTERS;

export default async function AgentReferrals({ searchParams }: PageProps<"/agent/referrals">) {
  const me = await requireRole("agent");
  const { show } = await searchParams;
  const filter: Filter = typeof show === "string" && show in FILTERS ? (show as Filter) : "all";
  const all = await getReferrals({ agentId: me.id });
  const referrals = all.filter(FILTERS[filter].test);
  const ordered = all.reduce((s, r) => s + r.total_ordered, 0);
  const earned = all.reduce((s, r) => s + r.commission_earned, 0);

  return (
    <>
      <PageHeader
        title="My referrals"
        description={`${all.length} referrals · ${php(ordered)} ordered · ${php(earned)} commission earned`}
        actions={
          <ButtonLink href="/agent/referrals/new" variant="gold">
            <Send className="size-4" aria-hidden /> Refer a client
          </ButtonLink>
        }
      />
      <Tabs
        active={filter}
        items={(Object.keys(FILTERS) as Filter[]).map((k) => ({
          key: k,
          label: FILTERS[k].label,
          href: k === "all" ? "/agent/referrals" : `/agent/referrals?show=${k}`,
          count: all.filter(FILTERS[k].test).length,
        }))}
      />
      <Card>
        {referrals.length === 0 ? (
          <EmptyState title={filter === "all" ? "No referrals yet" : "Nothing here"}>
            {filter === "all" ? "Refer a client and track their order from review to delivery here." : null}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Referred</Th>
                <Th>Progress</Th>
                <Th className="text-right">Ordered</Th>
                <Th className="text-right">Paid</Th>
                <Th className="text-right">Your commission</Th>
              </tr>
            </thead>
            <tbody className="tabular">
              {referrals.map((r) => (
                <tr key={r.id} className="hover:bg-paper">
                  <Td>
                    <Link href={`/agent/referrals/${r.id}`} className="font-medium hover:underline">
                      {r.client_name}
                    </Link>
                    {r.interested_in && <p className="text-xs text-graphite">{r.interested_in}</p>}
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDateShort(r.created_at)}</Td>
                  <Td>
                    <div className="space-y-1.5">
                      <Badge tone={REFERRAL_STAGE[r.stage].tone}>{REFERRAL_STAGE[r.stage].label}</Badge>
                      <ReferralProgress stage={r.stage} compact />
                    </div>
                  </Td>
                  <Td className="text-right font-mono">{r.total_ordered ? php(r.total_ordered) : "—"}</Td>
                  <Td className="text-right font-mono">{r.total_paid ? php(r.total_paid) : "—"}</Td>
                  <Td className="text-right font-mono font-medium">{r.commission_earned ? php(r.commission_earned) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
