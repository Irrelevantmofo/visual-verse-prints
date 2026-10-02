import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { Tabs } from "@/components/staff/tabs";
import { ReferralProgress } from "@/components/referral-progress";
import { fmtDateShort, php } from "@/lib/format";
import { REFERRAL_STAGE } from "@/lib/labels";
import { getReferrals } from "@/lib/queries";

export const metadata = { title: "Referrals" };

const FILTERS = ["submitted", "approved", "rejected", "all"] as const;

export default async function AdminReferrals({ searchParams }: PageProps<"/admin/referrals">) {
  const { status: s } = await searchParams;
  const status = FILTERS.includes(s as (typeof FILTERS)[number]) ? (s as (typeof FILTERS)[number]) : "submitted";
  const all = await getReferrals();
  const referrals = status === "all" ? all : all.filter((r) => r.status === status);
  const count = (k: (typeof FILTERS)[number]) => (k === "all" ? all.length : all.filter((r) => r.status === k).length);

  return (
    <>
      <PageHeader title="Referrals" description="Leads submitted by agents. Approve them to start quoting." />
      <Tabs
        active={status}
        items={[
          { key: "submitted", label: "Awaiting review", href: "/admin/referrals", count: count("submitted") },
          { key: "approved", label: "Approved", href: "/admin/referrals?status=approved", count: count("approved") },
          { key: "rejected", label: "Rejected", href: "/admin/referrals?status=rejected", count: count("rejected") },
          { key: "all", label: "All", href: "/admin/referrals?status=all", count: count("all") },
        ]}
      />
      <Card>
        {referrals.length === 0 ? (
          <EmptyState title={status === "submitted" ? "Nothing to review" : "No referrals here"}>
            {status === "submitted" ? "New referrals from agents will show up here." : null}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ref</Th>
                <Th>Client</Th>
                <Th>Agent</Th>
                <Th>Interested in</Th>
                <Th>Submitted</Th>
                <Th>Progress</Th>
                <Th className="text-right">Ordered</Th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="hover:bg-paper">
                  <Td className="font-mono text-xs text-graphite">R-{r.ref_no}</Td>
                  <Td>
                    <Link href={`/admin/referrals/${r.id}`} className="font-medium hover:underline">
                      {r.client_name}
                    </Link>
                    {r.client_company && <p className="text-xs text-graphite">{r.client_company}</p>}
                  </Td>
                  <Td>{r.agent_name}</Td>
                  <Td className="max-w-[14rem] text-graphite">{r.interested_in ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{fmtDateShort(r.created_at)}</Td>
                  <Td>
                    <div className="space-y-1.5">
                      <Badge tone={REFERRAL_STAGE[r.stage].tone}>{REFERRAL_STAGE[r.stage].label}</Badge>
                      <ReferralProgress stage={r.stage} compact />
                    </div>
                  </Td>
                  <Td className="text-right font-mono tabular">{r.total_ordered ? php(r.total_ordered) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
