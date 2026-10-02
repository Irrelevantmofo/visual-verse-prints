import { Card, PageHeader } from "@/components/ui";
import { getCatalog } from "@/lib/catalog";
import { pct } from "@/lib/format";
import { getCurrentProfile } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { ReferralForm } from "./referral-form";

export const metadata = { title: "Refer a client" };

const STEPS = [
  "The shop reviews your referral and contacts the client.",
  "You can follow it here: quoted, in production, ready, delivered.",
  "You earn commission on every payment the client makes.",
];

export default async function NewReferralPage() {
  const [products, settings, me] = await Promise.all([getCatalog(), getSettings(), getCurrentProfile()]);
  const rate = me?.commission_rate ?? settings.default_commission_rate;

  return (
    <>
      <PageHeader title="Refer a client" description={`You earn ${pct(rate)} of what your referred clients pay.`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card className="p-5">
          <ReferralForm products={products.map((p) => p.name)} />
        </Card>
        <aside className="h-fit rounded-lg bg-ink p-5 text-paper/80">
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
      </div>
    </>
  );
}
