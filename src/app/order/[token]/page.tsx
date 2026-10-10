import Image from "next/image";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CheckCircle2, Download, FileText, Smartphone } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui";
import { CopyButton, ShareButton } from "@/components/order/copy-button";
import { OrderFileUpload } from "@/components/order/file-upload";
import { ProofUploadForm } from "@/components/order/proof-upload";
import { fmtDate, php } from "@/lib/format";
import { SHOP } from "@/lib/catalog";
import { CUSTOMER_ORDER_STATUS, FULFILMENT, PROOF_STATUS } from "@/lib/labels";
import { formatBytes, ORDER_FILES_PER_ORDER } from "@/lib/order-files";
import { getCustomerOrder, orderUrl } from "@/lib/ordering";
import type { OrderStatus } from "@/types/db";

export const metadata = { title: "Your order" };
export const dynamic = "force-dynamic";

const STEPS: { label: string; reached: (s: OrderStatus, fullyPaid: boolean) => boolean }[] = [
  { label: "Order received", reached: () => true },
  { label: "Price confirmed", reached: (s) => s !== "pending_review" },
  { label: "Payment verified", reached: (_s, fullyPaid) => fullyPaid },
  { label: "In production", reached: (s) => ["in_progress", "ready", "delivered"].includes(s) },
  { label: "Ready", reached: (s) => ["ready", "delivered"].includes(s) },
  { label: "Completed", reached: (s) => s === "delivered" },
];

export default async function CustomerOrderPage({ params, searchParams }: PageProps<"/order/[token]">) {
  const { token } = await params;
  const { placed } = await searchParams;
  const data = await getCustomerOrder(token);
  if (!data) notFound();
  const { order, items, proofs, files, channels } = data;

  const link = await orderUrl(order.public_token);
  const linkQr = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const status = CUSTOMER_ORDER_STATUS[order.order_status];
  const priced = order.order_status !== "pending_review";
  const cancelled = order.order_status === "cancelled";
  const canPay = priced && !cancelled && order.balance > 0;
  const fullyPaid = priced && order.total_amount > 0 && order.balance <= 0;
  const open = !cancelled && order.order_status !== "delivered";
  const pendingProofs = proofs.filter((p) => p.status === "pending");

  return (
    <div className="space-y-6">
      {placed && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-medium">We got your order.</span> Keep this page&apos;s link: it&apos;s how you track the order, send your design
            and pay. Save it below before you close this tab.
          </p>
        </div>
      )}

      <div>
        <p className="font-mono text-xs tracking-[0.25em] text-foil-dark uppercase">Order #{order.order_no}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl font-bold uppercase sm:text-5xl">{status.label}</h1>
          {pendingProofs.length > 0 && <Badge tone="gold">Receipt being checked</Badge>}
        </div>
        <p className="mt-1 text-graphite">{status.detail}</p>
        <p className="mt-1 text-xs text-graphite">
          Placed {fmtDate(order.order_date)} by {order.client_name}
        </p>
      </div>

      {!cancelled && (
        <ol className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-6">
          {STEPS.map((step, i) => {
            const done = step.reached(order.order_status, fullyPaid);
            return (
              <li key={step.label} className="text-center">
                <span className={`mx-auto block h-1.5 rounded-full ${done ? "bg-foil" : "bg-rule"}`} />
                <span className={`mt-1.5 block text-xs ${done ? "font-medium text-ink" : "text-graphite"}`}>
                  {i + 1}. {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* ── What was ordered ── */}
      <Card>
        <CardHeader title="Your order" />
        <ul className="divide-y divide-rule/70">
          {items.map((it) => (
            <li key={it.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
              <span>
                <span className="font-mono text-xs text-graphite">{+it.qty.toFixed(2)}×</span> {it.description}
              </span>
              <span className="shrink-0 font-mono">{priced ? php(it.amount) : "—"}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t border-rule px-5 py-4 text-sm">
          <div className="flex justify-between">
            <dt>Total</dt>
            <dd className="font-mono font-semibold">{priced ? php(order.total_amount) : "To be confirmed"}</dd>
          </div>
          {priced && (
            <>
              <div className="flex justify-between text-graphite">
                <dt>Paid and verified</dt>
                <dd className="font-mono">{php(order.paid_amount)}</dd>
              </div>
              <div className="flex justify-between text-base font-medium">
                <dt>Balance</dt>
                <dd className="font-mono">{php(Math.max(order.balance, 0))}</dd>
              </div>
            </>
          )}
        </dl>
        {order.customer_notes && (
          <p className="border-t border-rule px-5 py-3 text-sm text-graphite">
            <span className="font-medium text-ink">Your note: </span>
            {order.customer_notes}
          </p>
        )}
      </Card>

      {/* ── Design files ── */}
      {(open || files.length > 0) && (
        <Card>
          <CardHeader
            title="Your design"
            description={open ? "Upload the artwork or reference files for this order. You can add more later from this page." : undefined}
          />
          {files.length > 0 && (
            <ul className="divide-y divide-rule/70">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <FileText className="size-4 shrink-0 text-graphite" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
                  <span className="shrink-0 text-xs text-graphite">
                    {formatBytes(f.size_bytes)} · {fmtDate(f.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {open && (
            <div className={files.length > 0 ? "border-t border-rule p-5" : "p-5"}>
              <OrderFileUpload token={order.public_token} remaining={ORDER_FILES_PER_ORDER - files.length} />
            </div>
          )}
        </Card>
      )}

      {/* ── Getting the order ── */}
      {order.fulfilment && (
        <Card>
          <CardHeader title={FULFILMENT[order.fulfilment].short} />
          <div className="space-y-2 p-5 text-sm">
            {order.fulfilment === "pickup" && <p>Collect your order from our shop in {SHOP.city}. This page will show when it&apos;s ready.</p>}
            {order.fulfilment === "lalamove" && (
              <>
                <p>
                  When this page says your order is ready, book a Lalamove rider yourself and pay the rider. Use this as the pick-up point:
                </p>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-paper-2 px-3 py-1.5 font-medium">{SHOP.pickupName}</span>
                  <CopyButton value={SHOP.pickupName} label="Copy" compact />
                </p>
              </>
            )}
            {order.fulfilment === "courier" && (
              <>
                <p>We&apos;ll ship by J&amp;T or LBC. The shipping fee is included in your total once we confirm it.</p>
                <dl className="rounded-md bg-paper p-3">
                  <dt className="text-xs text-graphite">Ship to</dt>
                  <dd className="mt-0.5 whitespace-pre-line">
                    {order.delivery_name}
                    {order.delivery_phone ? ` · ${order.delivery_phone}` : ""}
                    {"\n"}
                    {order.delivery_address}
                  </dd>
                </dl>
              </>
            )}
            <p className="border-t border-rule pt-3 text-graphite">
              <span className="font-medium text-ink">Lead time: {SHOP.leadTime}.</span> Need it sooner?{" "}
              <a href={SHOP.facebookUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                Message us on Facebook
              </a>{" "}
              to check if a rush is possible.
            </p>
          </div>
        </Card>
      )}

      {/* ── Pay ── */}
      {canPay && (
        <Card>
          <CardHeader
            title="Pay"
            description={`Send ${php(order.balance)}, then upload the receipt below. Full payment is required before we start printing.`}
          />
          {channels.length === 0 ? (
            <p className="px-5 py-5 text-sm text-graphite">Message us for payment details. They&apos;ll also appear here soon.</p>
          ) : (
            <ul className="divide-y divide-rule/70">
              {channels.map((c) => (
                <li key={c.id} className="flex flex-col gap-4 px-5 py-5 sm:flex-row">
                  {c.qr_url && (
                    <div className="shrink-0 self-center sm:self-start">
                      <Image
                        src={c.qr_url}
                        alt={`${c.name} QR code`}
                        width={200}
                        height={200}
                        unoptimized
                        className="size-48 rounded-md border border-rule bg-white object-contain p-1"
                      />
                      <a
                        href={`${c.qr_url}?download=${encodeURIComponent(`${c.name} QR.png`)}`}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-rule bg-white px-3 py-2 text-sm font-medium hover:bg-paper-2"
                      >
                        <Download className="size-4" aria-hidden /> Save QR to phone
                      </a>
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-3 text-sm">
                    <p className="font-display text-xl font-semibold uppercase">{c.name}</p>
                    {c.account_name && (
                      <div>
                        <p className="text-xs text-graphite">Account name</p>
                        <p className="font-medium">{c.account_name}</p>
                      </div>
                    )}
                    {c.account_number && (
                      <div>
                        <p className="text-xs text-graphite">Account number</p>
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-lg font-medium">{c.account_number}</span>
                          <CopyButton value={c.account_number.replace(/\s+/g, "")} label="Copy" compact />
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-graphite">Amount</p>
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-medium">{php(order.balance)}</span>
                        <CopyButton value={order.balance.toFixed(2)} label="Copy" compact />
                      </p>
                    </div>
                    {c.instructions && <p className="whitespace-pre-line text-graphite">{c.instructions}</p>}
                    {c.qr_url && (
                      <p className="text-xs text-graphite">
                        Paying on this phone? Tap <span className="font-medium text-ink">Save QR to phone</span>, then choose &ldquo;upload QR&rdquo; in
                        your banking app.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-rule p-5">
            <p className="mb-4 font-display text-xl font-semibold uppercase">Upload your receipt</p>
            <ProofUploadForm token={order.public_token} balance={order.balance} channels={channels.map((c) => ({ id: c.id, name: c.name }))} />
          </div>
        </Card>
      )}

      {/* ── Receipts sent ── */}
      {proofs.length > 0 && (
        <Card>
          <CardHeader title="Receipts you sent" />
          <ul className="divide-y divide-rule/70">
            {proofs.map((p) => (
              <li key={p.id} className="flex items-start gap-4 px-5 py-4 text-sm">
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label="Open receipt">
                    {/* Signed, short-lived link to a private file, so next/image doesn't apply */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="Payment receipt" className="h-20 w-14 rounded border border-rule object-cover" />
                  </a>
                ) : (
                  <span className="h-20 w-14 shrink-0 rounded border border-rule bg-paper-2" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium">{p.claimed_amount != null ? php(p.claimed_amount) : "—"}</span>
                    <Badge tone={PROOF_STATUS[p.status].tone}>{PROOF_STATUS[p.status].label}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-graphite">
                    Sent {fmtDate(p.created_at)}
                    {p.reference ? ` · Ref ${p.reference}` : ""}
                  </p>
                  {p.status === "rejected" && p.review_note && (
                    <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-rose-900">
                      <span className="font-medium">From the shop: </span>
                      {p.review_note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Keep / move this order ── */}
      <Card>
        <CardHeader title="Keep this order link" description="This link is the only way back to your order. Anyone with it can view the order, so share it only with people you trust." />
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <div className="hidden shrink-0 sm:block">
            <div className="size-36 rounded-md border border-rule bg-white p-1.5" dangerouslySetInnerHTML={{ __html: linkQr }} aria-label="QR code for this order page" role="img" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="hidden items-start gap-2 text-sm sm:flex">
              <Smartphone className="mt-0.5 size-4 shrink-0 text-foil-dark" aria-hidden />
              <span>
                <span className="font-medium">Continue on your phone:</span> scan this code with your camera to open this order there, so you can upload the
                receipt from your banking app.
              </span>
            </p>
            <p className="rounded-md bg-paper-2 px-3 py-2 font-mono text-xs break-all text-graphite">{link}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={link} label="Copy link" />
              <ShareButton url={link} title={`My Visual Verse Prints order #${order.order_no}`} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
