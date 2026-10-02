import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatTile, Table, Td, Th } from "@/components/ui";
import { ReferralProgress } from "@/components/referral-progress";
import { fmtDate, fmtDateShort, php } from "@/lib/format";
import { ORDER_STATUS, PAYMENT_STATUS, QUOTE_STATUS, REFERRAL_STAGE } from "@/lib/labels";
import { requireRole } from "@/lib/auth";
import { getOrders, getQuotations, getReferral } from "@/lib/queries";

export const metadata = { title: "Referral" };

export default async function AgentReferralDetail({ params, searchParams }: PageProps<"/agent/referrals/[id]">) {
  const me = await requireRole("agent");
  const { id } = await params;
  const { submitted } = await searchParams;
  const referral = await getReferral(id);
  if (!referral || referral.agent_id !== me.id) notFound();
  const [orders, quotes] = await Promise.all([getOrders({ referralId: id }), getQuotations({ referralId: id })]);
  const pending = orders.reduce((s, o) => s + o.commission_pending, 0);

  return (
    <>
      <Link href="/agent/referrals" className="mb-3 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
        <ArrowLeft className="size-4" /> My referrals
      </Link>

      {submitted && referral.status === "submitted" && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          Referral sent. The shop will review it and reach out to {referral.client_name}.
        </div>
      )}

      <PageHeader
        title={referral.client_name}
        description={`Referred ${fmtDate(referral.created_at)}${referral.client_company ? ` · ${referral.client_company}` : ""}`}
        actions={<Badge tone={REFERRAL_STAGE[referral.stage].tone}>{REFERRAL_STAGE[referral.stage].label}</Badge>}
      />

      <Card className="mb-6 p-5">
        <ReferralProgress stage={referral.stage} />
        {referral.review_notes && (
          <p className="mt-5 rounded-md bg-paper px-4 py-3 text-sm">
            <span className="font-medium">Note from the shop: </span>
            {referral.review_notes}
          </p>
        )}
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Ordered" value={php(referral.total_ordered)} hint={`${referral.order_count} ${referral.order_count === 1 ? "order" : "orders"}`} />
        <StatTile label="Paid so far" value={php(referral.total_paid)} />
        <StatTile label="Your commission" value={php(referral.commission_earned)} emphasis />
        <StatTile label="Still to earn" value={php(pending)} hint="When the balance is paid" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Orders" />
            {orders.length === 0 ? (
              <EmptyState title="No orders yet">
                {referral.status === "submitted"
                  ? "Orders appear here once the shop approves this referral and the client orders."
                  : "Orders appear here once the client confirms."}
              </EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Items</Th>
                    <Th className="text-right">Total</Th>
                    <Th>Payment</Th>
                    <Th>Production</Th>
                    <Th className="text-right">Commission</Th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <Td className="whitespace-nowrap">{fmtDateShort(o.order_date)}</Td>
                      <Td className="text-graphite">{o.items}</Td>
                      <Td className="text-right font-mono">{php(o.total_amount)}</Td>
                      <Td>
                        <Badge tone={PAYMENT_STATUS[o.payment_status].tone}>{PAYMENT_STATUS[o.payment_status].label}</Badge>
                      </Td>
                      <Td>
                        <Badge tone={ORDER_STATUS[o.order_status].tone}>{ORDER_STATUS[o.order_status].label}</Badge>
                      </Td>
                      <Td className="text-right font-mono">{php(o.commission_earned)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {quotes.length > 0 && (
            <Card>
              <CardHeader title="Quotations" />
              <Table>
                <thead>
                  <tr>
                    <Th>Sent</Th>
                    <Th>For</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <Td>{fmtDateShort(q.date_sent)}</Td>
                      <Td className="text-graphite">{q.description ?? "—"}</Td>
                      <Td className="text-right font-mono">{php(q.quoted_amount)}</Td>
                      <Td>
                        <Badge tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader title="What you sent" />
          <dl className="space-y-3 p-5 text-sm">
            <div>
              <dt className="text-graphite">Contact</dt>
              <dd className="break-words">{referral.client_contact}</dd>
            </div>
            <div>
              <dt className="text-graphite">Interested in</dt>
              <dd>{referral.interested_in ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-graphite">Estimated budget</dt>
              <dd className="font-mono">{referral.estimated_budget != null ? php(referral.estimated_budget) : "—"}</dd>
            </div>
            <div>
              <dt className="text-graphite">Notes</dt>
              <dd className="whitespace-pre-line">{referral.notes ?? "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
