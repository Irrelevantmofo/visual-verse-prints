import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { getFormOptions } from "@/lib/options";
import { getSettings } from "@/lib/queries";
import { QuoteForm } from "../quote-form";

export const metadata = { title: "New quotation" };

export default async function NewQuotationPage({ searchParams }: PageProps<"/admin/quotations/new">) {
  const { referral } = await searchParams;
  const referralId = typeof referral === "string" ? referral : undefined;
  const [{ agentOptions, referralOptions }, settings] = await Promise.all([getFormOptions(referralId), getSettings()]);
  const ref = referralOptions.find((r) => r.id === referralId);

  return (
    <>
      <Link href="/admin/quotations" className="mb-3 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
        <ArrowLeft className="size-4" /> Quotations
      </Link>
      <PageHeader title="New quotation" />
      <Card className="max-w-3xl p-5">
        <QuoteForm
          agents={agentOptions}
          referrals={referralOptions}
          validityDays={settings.quote_validity_days}
          defaults={{
            date_sent: todayISO(),
            referral_id: ref?.id ?? null,
            agent_id: ref?.agentId ?? null,
            client_name: ref?.clientName ?? "",
            client_contact: ref?.clientContact ?? null,
          }}
        />
      </Card>
    </>
  );
}
