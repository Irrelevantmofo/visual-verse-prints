import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { isISODate, num, todayISO } from "@/lib/format";
import { getFormOptions, getOrderFormCommission } from "@/lib/options";
import { createClient } from "@/lib/supabase/server";
import type { Quotation } from "@/types/db";
import { OrderForm } from "../order-form";

export const metadata = { title: "New order" };

export default async function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Converting a quote pre-fills client, agent, referral and amount.
  let quote: Quotation | null = null;
  if (typeof sp.quote === "string") {
    const { data } = await supabase.from("quotations").select("*").eq("id", sp.quote).maybeSingle();
    quote = (data as Quotation | null) ?? null;
  }
  const referralId = quote?.referral_id ?? (typeof sp.referral === "string" ? sp.referral : undefined);

  const [{ agentOptions, referralOptions }, { products, commission }] = await Promise.all([
    getFormOptions(referralId),
    getOrderFormCommission(),
  ]);
  const ref = referralOptions.find((r) => r.id === referralId);

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
        <ArrowLeft className="size-4" /> Orders
      </Link>
      <PageHeader title="New order" description={quote ? `From quote Q-${quote.quote_no}` : undefined} />
      <Card className="max-w-4xl p-5">
        <OrderForm
          agents={agentOptions}
          referrals={referralOptions}
          products={products}
          commission={commission}
          defaults={{
            order_date: isISODate(sp.date) ? sp.date : todayISO(),
            quotation_id: quote?.id ?? null,
            referral_id: ref?.id ?? null,
            agent_id: quote?.agent_id ?? ref?.agentId ?? null,
            client_name: quote?.client_name ?? ref?.clientName ?? "",
            client_contact: quote?.client_contact ?? ref?.clientContact ?? null,
            source: ref || quote?.agent_id ? "referral" : "direct",
            quoted_amount: quote ? num(quote.quoted_amount) : undefined,
            description: quote?.description ?? null,
          }}
        />
      </Card>
    </>
  );
}
