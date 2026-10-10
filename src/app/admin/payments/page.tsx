import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { fmtDate, num, php, todayISO } from "@/lib/format";
import { ORDER_STATUS, PROOF_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, ProofStatus } from "@/types/db";
import { ProofReview } from "./review-forms";

export const metadata = { title: "Payments to verify" };

type ProofRow = {
  id: string;
  order_id: string;
  storage_path: string;
  claimed_amount: number | string | null;
  reference: string | null;
  status: ProofStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  channel: { name: string } | { name: string }[] | null;
};

const channelName = (c: ProofRow["channel"]) => (Array.isArray(c) ? c[0]?.name : c?.name) ?? null;

export default async function PaymentsPage() {
  const supabase = await createClient();
  const select = "id, order_id, storage_path, claimed_amount, reference, status, review_note, reviewed_at, created_at, channel:payment_channels(name)";
  const [{ data: pendingData }, { data: recentData }] = await Promise.all([
    supabase.from("payment_proofs").select(select).eq("status", "pending").order("created_at"),
    supabase.from("payment_proofs").select(select).neq("status", "pending").order("reviewed_at", { ascending: false }).limit(20),
  ]);
  const pending = (pendingData ?? []) as ProofRow[];
  const recent = (recentData ?? []) as ProofRow[];

  const orderIds = [...new Set([...pending, ...recent].map((p) => p.order_id))];
  const { data: ordersData } = orderIds.length
    ? await supabase.from("order_summary").select("id, order_no, client_name, client_contact, total_amount, paid_amount, balance, order_status").in("id", orderIds)
    : { data: [] };
  const orders = new Map((ordersData ?? []).map((o) => [o.id as string, o]));

  // Receipts are private files; these links expire after an hour
  const { data: signed } = pending.length
    ? await supabase.storage.from("payment-proofs").createSignedUrls(
        pending.map((p) => p.storage_path),
        60 * 60,
      )
    : { data: [] };
  const today = todayISO();

  return (
    <>
      <PageHeader
        title="Payments to verify"
        description="Receipts customers uploaded from their order links. Check each against your bank or e-wallet before verifying."
      />

      {pending.length === 0 ? (
        <Card>
          <EmptyState title="Nothing to verify">New receipts from customers appear here.</EmptyState>
        </Card>
      ) : (
        <ul className="space-y-6">
          {pending.map((p, i) => {
            const order = orders.get(p.order_id);
            const url = signed?.[i]?.signedUrl ?? null;
            const balance = num(order?.balance);
            return (
              <li key={p.id}>
                <Card>
                  <div className="grid gap-6 p-5 md:grid-cols-[14rem_1fr]">
                    <div>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block" aria-label="Open receipt full size">
                          {/* Signed, short-lived link to a private file, so next/image doesn't apply */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="Customer's payment receipt" className="max-h-96 w-full rounded-md border border-rule bg-paper-2 object-contain" />
                          <span className="mt-1 block text-center text-xs text-graphite underline">Open full size</span>
                        </a>
                      ) : (
                        <p className="rounded-md bg-paper-2 p-4 text-sm text-graphite">The image couldn&apos;t be loaded.</p>
                      )}
                    </div>
                    <div className="min-w-0 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-2xl font-semibold uppercase">
                            {p.claimed_amount != null ? php(p.claimed_amount) : "Amount not given"}
                            <span className="ml-2 text-sm font-normal tracking-normal text-graphite normal-case">claimed</span>
                          </p>
                          <p className="text-sm text-graphite">
                            Sent {fmtDate(p.created_at)}
                            {channelName(p.channel) ? ` · via ${channelName(p.channel)}` : ""}
                            {p.reference ? ` · Ref ${p.reference}` : ""}
                          </p>
                        </div>
                        {order && (
                          <Link href={`/admin/orders/${p.order_id}`} className="text-right text-sm hover:underline">
                            <span className="block font-medium">
                              Order #{order.order_no} · {order.client_name}
                            </span>
                            <span className="block text-xs text-graphite">{order.client_contact}</span>
                          </Link>
                        )}
                      </div>
                      {order && (
                        <dl className="grid grid-cols-3 gap-3 rounded-md bg-paper p-3 text-sm">
                          <div>
                            <dt className="text-xs text-graphite">Order total</dt>
                            <dd className="font-mono">{php(order.total_amount)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-graphite">Verified so far</dt>
                            <dd className="font-mono">{php(order.paid_amount)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-graphite">Balance</dt>
                            <dd className="font-mono font-medium">{php(balance)}</dd>
                          </div>
                        </dl>
                      )}
                      <ProofReview
                        proofId={p.id}
                        claimedAmount={p.claimed_amount == null ? null : num(p.claimed_amount)}
                        balance={balance}
                        reference={p.reference}
                        today={today}
                        canVerify={order?.order_status !== "pending_review"}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {recent.length > 0 && (
        <Card className="mt-8">
          <CardHeader title="Recently reviewed" />
          <Table>
            <thead>
              <tr>
                <Th>Reviewed</Th>
                <Th>Order</Th>
                <Th className="text-right">Claimed</Th>
                <Th>Result</Th>
                <Th>Note to customer</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => {
                const order = orders.get(p.order_id);
                return (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap">{fmtDate(p.reviewed_at)}</Td>
                    <Td>
                      {order ? (
                        <Link href={`/admin/orders/${p.order_id}`} className="hover:underline">
                          #{order.order_no} · {order.client_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {order && (
                        <span className="ml-2">
                          <Badge tone={ORDER_STATUS[order.order_status as OrderStatus].tone}>{ORDER_STATUS[order.order_status as OrderStatus].label}</Badge>
                        </span>
                      )}
                    </Td>
                    <Td className="text-right font-mono">{p.claimed_amount != null ? php(p.claimed_amount) : "—"}</Td>
                    <Td>
                      <Badge tone={PROOF_STATUS[p.status].tone}>{p.status === "approved" ? "Verified" : "Rejected"}</Badge>
                    </Td>
                    <Td className="max-w-xs text-graphite">{p.review_note ?? "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
