import Link from "next/link";
import QRCode from "qrcode";
import { ArrowRight, Send } from "lucide-react";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { Leaderboard } from "@/components/leaderboard";
import { ReferralProgress } from "@/components/referral-progress";
import { fmtDateShort, fmtMonth, monthStart, php, todayISO } from "@/lib/format";
import { isBookedOrder, REFERRAL_STAGE } from "@/lib/labels";
import { requireRole } from "@/lib/auth";
import { isOrderingEnabled, siteOrigin } from "@/lib/ordering";
import { CopyButton, ShareButton } from "@/components/order/copy-button";
import { getCommissionEarnings, getLeaderboard, getOrders, getPayouts, getReferrals } from "@/lib/queries";

export const metadata = { title: "Overview" };

export default async function AgentOverview() {
  const me = await requireRole("agent");
  const today = todayISO();
  const from = monthStart(today);

  const [referrals, orders, earnings, payouts, board] = await Promise.all([
    getReferrals({ agentId: me.id }),
    getOrders({ agentId: me.id }),
    getCommissionEarnings({ agentId: me.id }),
    getPayouts({ agentId: me.id }),
    getLeaderboard(from, today),
  ]);

  const earnedMonth = earnings.filter((e) => e.paid_on >= from).reduce((s, e) => s + e.commission, 0);
  const earnedAll = earnings.reduce((s, e) => s + e.commission, 0);
  const paidOut = payouts.reduce((s, p) => s + p.amount, 0);
  const pending = orders.reduce((s, o) => s + o.commission_pending, 0);
  const bookedMonth = orders.filter((o) => o.order_date >= from && isBookedOrder(o.order_status)).reduce((s, o) => s + o.total_amount, 0);

  const orderingEnabled = await isOrderingEnabled();
  const myLink = `${await siteOrigin()}/order?ref=${me.referral_code}`;
  const myLinkQr = orderingEnabled ? await QRCode.toString(myLink, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : "";

  const mine = board.find((r) => r.agent_id === me.id);
  const ahead = mine ? board.filter((r) => r.rank < mine.rank).at(-1) : undefined;
  const firstName = me.full_name.split(" ")[0] || "there";

  return (
    <>
      <PageHeader
        title={`Hi, ${firstName}`}
        description={`Here's how your referrals are doing in ${fmtMonth(today)}.`}
        actions={
          <ButtonLink href="/agent/referrals/new" variant="gold">
            <Send className="size-4" aria-hidden /> Refer a client
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Commission this month" value={php(earnedMonth)} emphasis hint={`From ${php(bookedMonth)} in referral orders`} />
        <StatTile label="Waiting on payment" value={php(pending)} hint="You earn this as clients pay their balances" />
        <StatTile label="Earned, all time" value={php(earnedAll)} />
        <StatTile label="Not yet paid to you" value={php(Math.max(earnedAll - paidOut, 0))} hint={`${php(paidOut)} paid out so far`} />
      </div>

      {orderingEnabled && (
        <Card className="mt-6">
          <CardHeader
            title="Your order link"
            description="Share this with clients. Orders placed through it are credited to you and show up in My referrals."
          />
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
            <div
              className="size-28 shrink-0 rounded-md border border-rule bg-white p-1.5"
              dangerouslySetInnerHTML={{ __html: myLinkQr }}
              aria-label="QR code for your order link"
              role="img"
            />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="rounded-md bg-paper-2 px-3 py-2 font-mono text-xs break-all text-graphite">{myLink}</p>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={myLink} label="Copy link" />
                <ShareButton url={myLink} title="Order from Visual Verse Prints" />
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader
            title="Recent referrals"
            action={
              <Link href="/agent/referrals" className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
                See all <ArrowRight className="size-4" />
              </Link>
            }
          />
          {referrals.length === 0 ? (
            <EmptyState title="Refer your first client">
              Know someone who needs stickers, calling cards or packaging? Send their details and earn commission on every peso they pay.
              <div className="mt-4">
                <ButtonLink href="/agent/referrals/new" variant="gold">
                  Refer a client
                </ButtonLink>
              </div>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-rule/70">
              {referrals.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link href={`/agent/referrals/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-paper">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.client_name}</p>
                      <p className="text-xs text-graphite">Referred {fmtDateShort(r.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden space-y-1 text-right sm:block">
                        <Badge tone={REFERRAL_STAGE[r.stage].tone}>{REFERRAL_STAGE[r.stage].label}</Badge>
                        <ReferralProgress stage={r.stage} compact />
                      </div>
                      <div className="w-28 text-right">
                        <p className="font-mono text-sm">{r.total_ordered ? php(r.total_ordered) : "—"}</p>
                        <p className="text-xs text-graphite">ordered</p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader
            title="This month's ranking"
            description={
              mine
                ? mine.rank === 1
                  ? mine.commission_earned > 0
                    ? "You're in first place. Keep it going!"
                    : "No commissions yet this month. Your next referral could take the lead."
                  : ahead
                    ? `You're #${mine.rank}. ${php(ahead.commission_earned - mine.commission_earned)} more in commission passes ${ahead.agent_name}.`
                    : `You're #${mine.rank}.`
                : undefined
            }
          />
          <Leaderboard rows={board} meId={me.id} showSales={false} />
          <div className="border-t border-rule px-5 py-3">
            <Link href="/agent/leaderboard" className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
              Full leaderboard <ArrowRight className="size-4" />
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
