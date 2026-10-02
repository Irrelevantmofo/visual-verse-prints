import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatTile, Table, Td, Th, buttonStyles, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteOrder, deletePayment } from "@/lib/actions/admin";
import { fmtDate, num, pct, php, todayISO } from "@/lib/format";
import { DELIVERY_STATUS, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/labels";
import { getOrder } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { OrderItem, Payment } from "@/types/db";
import { PaymentForm, StatusForm } from "./order-actions";

export const metadata = { title: "Order" };

export default async function OrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const supabase = await createClient();
  const [{ data: itemsData }, { data: paymentsData }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).order("position"),
    supabase.from("payments").select("*").eq("order_id", id).order("paid_on", { ascending: false }),
  ]);
  const items = (itemsData ?? []) as OrderItem[];
  const payments = (paymentsData ?? []) as Payment[];

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
        <ArrowLeft className="size-4" /> Orders
      </Link>
      <PageHeader
        title={`Order #${order.order_no}`}
        description={`${order.client_name} · ${fmtDate(order.order_date)}`}
        actions={
          <ButtonLink href={`/admin/orders/${id}/edit`} variant="secondary">
            Edit order
          </ButtonLink>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total" value={php(order.total_amount)} emphasis />
        <StatTile label="Paid" value={php(order.paid_amount)} />
        <StatTile label="Balance" value={php(order.balance)} />
        <StatTile
          label="Agent commission"
          value={php(order.commission_earned)}
          hint={order.agent_id ? `${pct(order.commission_rate)} of paid · ${php(order.commission_pending)} more when fully paid` : "No agent on this order"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Details"
              action={
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={PAYMENT_STATUS[order.payment_status].tone}>{PAYMENT_STATUS[order.payment_status].label}</Badge>
                  <Badge tone={ORDER_STATUS[order.order_status].tone}>{ORDER_STATUS[order.order_status].label}</Badge>
                </div>
              }
            />
            <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-graphite">Client contact</dt>
                <dd className="mt-0.5 break-words">{order.client_contact ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-graphite">Agent</dt>
                <dd className="mt-0.5">{order.agent_name ?? "Direct"}</dd>
              </div>
              <div>
                <dt className="text-graphite">Delivery</dt>
                <dd className="mt-0.5">{DELIVERY_STATUS[order.delivery_status].label}</dd>
              </div>
              {order.referral_id && (
                <div>
                  <dt className="text-graphite">Referral</dt>
                  <dd className="mt-0.5">
                    <Link href={`/admin/referrals/${order.referral_id}`} className="underline">
                      View referral
                    </Link>
                  </dd>
                </div>
              )}
              {order.quotation_id && (
                <div>
                  <dt className="text-graphite">Quotation</dt>
                  <dd className="mt-0.5">
                    <Link href={`/admin/quotations/${order.quotation_id}`} className="underline">
                      View quotation
                    </Link>
                  </dd>
                </div>
              )}
              {order.notes && (
                <div className="sm:col-span-3">
                  <dt className="text-graphite">Notes</dt>
                  <dd className="mt-0.5 whitespace-pre-line">{order.notes}</dd>
                </div>
              )}
            </dl>
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Unit</Th>
                  <Th className="text-right">Line total</Th>
                </tr>
              </thead>
              <tbody className="tabular">
                {items.map((it) => (
                  <tr key={it.id}>
                    <Td>{it.description}</Td>
                    <Td className="text-right font-mono">{num(it.qty)}</Td>
                    <Td className="text-right font-mono text-graphite">{php(num(it.amount) / num(it.qty))}</Td>
                    <Td className="text-right font-mono">{php(it.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Payments" description="Commission is earned on these amounts." />
            {payments.length === 0 ? (
              <EmptyState title="No payments yet" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Method</Th>
                    <Th>Reference</Th>
                    <Th className="text-right">Amount</Th>
                    <Th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <Td>{fmtDate(p.paid_on)}</Td>
                      <Td>{PAYMENT_METHOD[p.method]}</Td>
                      <Td className="text-graphite">{p.reference ?? "—"}</Td>
                      <Td className="text-right font-mono">{php(p.amount)}</Td>
                      <Td>
                        <form action={deletePayment}>
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmButton message="Remove this payment?" className={cx(buttonStyles.ghost, "px-2")} aria-label="Remove payment">
                            <Trash2 className="size-4" />
                          </ConfirmButton>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <div className="border-t border-rule p-5">
              <PaymentForm orderId={id} balance={order.balance} today={todayISO()} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-fit">
            <CardHeader title="Production" description="Agents see this progress on their referral." />
            <div className="p-5">
              <StatusForm id={id} orderStatus={order.order_status} deliveryStatus={order.delivery_status} />
            </div>
          </Card>
          <form action={deleteOrder}>
            <input type="hidden" name="id" value={id} />
            <ConfirmButton message="Delete this order and its payments? This can't be undone." className={buttonStyles.danger}>
              Delete order
            </ConfirmButton>
          </form>
        </div>
      </div>
    </>
  );
}
