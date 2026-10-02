import { Card, PageHeader } from "@/components/ui";
import { num, pct } from "@/lib/format";
import { getCurrentProfile } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { ReferralForm } from "./referral-form";

export const metadata = { title: "Refer a client" };

const STEPS = [
  "The shop reviews your referral and contacts the client.",
  "You can follow it here: quoted, in production, ready, delivered.",
  "You earn commission on every payment the client makes.",
];

export default async function NewReferralPage() {
  const supabase = await createClient();
  const [settings, me, { data: rates }] = await Promise.all([
    getSettings(),
    getCurrentProfile(),
    supabase.from("products").select("id, name, commission_rate").eq("active", true).order("sort_order"),
  ]);
  const products = (rates ?? []).map((r) => ({ id: r.id as string, name: r.name as string }));
  const fallback = me?.commission_rate ?? settings.default_commission_rate;
  const rateRows = (rates ?? []).map((r) => ({
    name: r.name as string,
    rate: r.commission_rate == null ? fallback : num(r.commission_rate),
  }));

  return (
    <>
      <PageHeader title="Refer a client" description="You earn commission on what your referred clients pay. The rate depends on the product." />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card className="h-fit p-5">
          <ReferralForm products={products} />
        </Card>
        <div className="space-y-6">
          <aside className="rounded-lg bg-ink p-5 text-paper/80">
            <p className="font-display text-lg font-semibold tracking-wide text-paper uppercase">What happens next</p>
            <ol className="mt-3 space-y-3 text-sm">
              {STEPS.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="font-mono text-foil-light">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </aside>
          {rateRows.length > 0 && (
            <Card>
              <div className="border-b border-rule px-5 py-3">
                <p className="font-display text-lg font-semibold tracking-wide uppercase">What you earn</p>
                <p className="text-xs text-graphite">Usual commission per product. The shop may adjust it on an order.</p>
              </div>
              <ul className="divide-y divide-rule/70 text-sm">
                {rateRows.map((r) => (
                  <li key={r.name} className="flex items-center justify-between px-5 py-2">
                    <span>{r.name}</span>
                    <span className="font-mono">{pct(r.rate)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
