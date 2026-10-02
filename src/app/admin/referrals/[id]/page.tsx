import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { ReferralProgress } from "@/components/referral-progress";
import { fmtDate, fmtDateShort, php } from "@/lib/format";
import { ORDER_STATUS, PAYMENT_STATUS, QUOTE_STATUS, REFERRAL_STATUS } from "@/lib/labels";
import { getOrders, getQuotations, getReferral, getReferralItems } from "@/lib/queries";
import { ReviewForm } from "./review-form";

export const metadata = { title: "Referral" };

export default async function AdminReferralDetail({ params }: PageProps<"/admin/referrals/[id]">) {
  const { id } = await params;
  const referral = await getReferral(id);
  if (!referral) notFound();
  const [quotes, orders, requested] = await Promise.all([
    getQuotations({ referralId: id }),
    getOrders({ referralId: id }),
    getReferralItems(id),
  ]);

  return (
    <>
      <Link href="/admin/referrals" className="mb-3 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
        <ArrowLeft className="size-4" /> Referrals
      </Link>
      <PageHeader
        title={referral.client_name}
        description={`R-${referral.ref_no} · referred by ${referral.agent_name} on ${fmtDate(referral.created_at)}`}
        actions={
          referral.status === "approved" && (
            <>
              <ButtonLink href={`/admin/quotations/new?referral=${id}`} variant="secondary">
                New quotation
              </ButtonLink>
              <ButtonLink href={`/admin/orders/new?referral=${id}`}>New order</ButtonLink>
            </>
          )
        }
      />

      <Card className="mb-6 p-5">
        <ReferralProgress stage={referral.stage} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Client details"
              action={<Badge tone={REFERRAL_STATUS[referral.status].tone}>{REFERRAL_STATUS[referral.status].label}</Badge>}
            />
            <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-graphite">Contact</dt>
                <dd className="mt-0.5 font-medium break-words">{referral.client_contact}</dd>
              </div>
              <div>
                <dt className="text-graphite">Company / organization</dt>
                <dd className="mt-0.5">{referral.client_company ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-graphite">Interested in</dt>
                <dd className="mt-0.5">{referral.interested_in ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-graphite">Estimated budget</dt>
                <dd className="mt-0.5 font-mono">{referral.estimated_budget != null ? php(referral.estimated_budget) : "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-graphite">Agent&apos;s notes</dt>
                <dd className="mt-0.5 whitespace-pre-line">{referral.notes ?? "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Requested products"
              description={requested.length ? "From the agent. New orders and quotations start with these." : undefined}
            />
            {requested.length === 0 ? (
              <p className="px-5 py-4 text-sm text-graphite">{referral.interested_in ?? "The agent didn't list products."}</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th className="text-right">Qty</Th>
                    <Th>Details</Th>
                  </tr>
                </thead>
                <tbody>
                  {requested.map((it) => (
                    <tr key={it.id}>
                      <Td className="font-medium">
                        {it.description}
                        {!it.product_id && <span className="ml-2 text-xs font-normal text-graphite">(not in catalog)</span>}
                      </Td>
                      <Td className="text-right font-mono">{+it.qty.toFixed(2)}</Td>
                      <Td className="text-graphite">{it.details ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="Quotations" />
            {quotes.length === 0 ? (
              <EmptyState title="No quotations yet" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Sent</Th>
                    <Th>Description</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <Td>
                        <Link href={`/admin/quotations/${q.id}`} className="hover:underline">
                          {fmtDateShort(q.date_sent)}
                        </Link>
                      </Td>
                      <Td className="text-graphite">{q.description ?? "—"}</Td>
                      <Td className="text-right font-mono">{php(q.quoted_amount)}</Td>
                      <Td>
                        <Badge tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Orders"
              description={orders.length ? `${php(referral.total_ordered)} ordered · ${php(referral.total_paid)} paid` : undefined}
            />
            {orders.length === 0 ? (
              <EmptyState title="No orders yet" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Items</Th>
                    <Th className="text-right">Total</Th>
                    <Th>Payment</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <Td>
                        <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                          {fmtDateShort(o.order_date)}
                        </Link>
                      </Td>
                      <Td className="text-graphite">{o.items}</Td>
                      <Td className="text-right font-mono">{php(o.total_amount)}</Td>
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
        </div>

        <Card className="h-fit">
          <CardHeader
            title="Review"
            description={
              referral.reviewed_at ? `Last reviewed ${fmtDate(referral.reviewed_at)}` : "Approve to start quoting, or reject with a note."
            }
          />
          <div className="p-5">
            <ReviewForm id={referral.id} status={referral.status} notes={referral.review_notes} />
          </div>
        </Card>
      </div>
    </>
  );
}
