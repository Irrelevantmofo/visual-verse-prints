import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ButtonLink, Card, PageHeader, buttonStyles } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteQuotation } from "@/lib/actions/admin";
import { fmtDate } from "@/lib/format";
import { isOpenQuote } from "@/lib/labels";
import { getFormOptions } from "@/lib/options";
import { getSettings } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { Quotation } from "@/types/db";
import { QuoteForm } from "../quote-form";

export const metadata = { title: "Quotation" };

export default async function EditQuotationPage({ params }: PageProps<"/admin/quotations/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("quotations").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const quote = data as Quotation;
  const [{ agentOptions, referralOptions }, settings] = await Promise.all([getFormOptions(quote.referral_id), getSettings()]);

  return (
    <>
      <Link href="/admin/quotations" className="mb-3 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
        <ArrowLeft className="size-4" /> Quotations
      </Link>
      <PageHeader
        title={`Quote Q-${quote.quote_no}`}
        description={`${quote.client_name} · sent ${fmtDate(quote.date_sent)}`}
        actions={
          isOpenQuote(quote.status) && (
            <ButtonLink href={`/admin/orders/new?quote=${quote.id}`} variant="gold">
              Convert to order
            </ButtonLink>
          )
        }
      />
      <Card className="max-w-3xl p-5">
        <QuoteForm quote={quote} agents={agentOptions} referrals={referralOptions} defaults={{}} validityDays={settings.quote_validity_days} />
      </Card>
      <form action={deleteQuotation} className="mt-6">
        <input type="hidden" name="id" value={quote.id} />
        <ConfirmButton message="Delete this quotation? This can't be undone." className={buttonStyles.danger}>
          Delete quotation
        </ConfirmButton>
      </form>
    </>
  );
}
