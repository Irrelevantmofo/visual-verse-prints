import Link from "next/link";
import { Badge, Card, CardHeader, PageHeader, buttonStyles } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteChannel } from "@/lib/actions/payments";
import { PAYMENT_METHOD } from "@/lib/labels";
import { getPaymentChannels, getSettings } from "@/lib/queries";
import { ChannelForm } from "./channel-form";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, channels] = await Promise.all([getSettings(), getPaymentChannels()]);
  const activeChannels = channels.filter((c) => c.active).length;
  const nextSort = (channels.at(-1)?.sort_order ?? 0) + 10;

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,34rem)_1fr]">
        <Card className="h-fit p-5">
          <SettingsForm
            ratePct={+(settings.default_commission_rate * 100).toFixed(2)}
            validityDays={settings.quote_validity_days}
            dueSoonDays={settings.due_soon_days}
            orderingEnabled={settings.online_ordering_enabled}
            activeChannels={activeChannels}
          />
        </Card>

        <Card className="h-fit">
          <CardHeader
            title="Payment channels"
            description={
              <>
                Where website customers pay. Shown with the QR on each customer&apos;s order page.{" "}
                {settings.online_ordering_enabled && (
                  <Link href="/order" target="_blank" className="underline">
                    Open the order form
                  </Link>
                )}
              </>
            }
          />
          {channels.length > 0 && (
            <ul className="divide-y divide-rule">
              {channels.map((c) => (
                <li key={c.id}>
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 hover:bg-paper">
                      <span>
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-xs text-graphite">
                          {PAYMENT_METHOD[c.method]}
                          {c.account_number ? ` · ${c.account_number}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {!c.qr_url && <Badge tone="amber">No QR</Badge>}
                        {!c.active && <Badge tone="neutral">Hidden</Badge>}
                      </span>
                    </summary>
                    <div className="space-y-4 border-t border-rule bg-paper/50 px-5 py-4">
                      <ChannelForm channel={c} />
                      <form action={deleteChannel}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmButton message={`Delete ${c.name}? Uncheck "Show to customers" to just hide it.`} className={buttonStyles.danger}>
                          Delete channel
                        </ConfirmButton>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-rule p-5">
            <p className="mb-3 font-display text-lg font-semibold uppercase">Add a channel</p>
            <ChannelForm nextSort={nextSort} />
          </div>
        </Card>
      </div>
    </>
  );
}
