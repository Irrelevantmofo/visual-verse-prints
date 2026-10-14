import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { num } from "@/lib/format";
import { getFormOptions, getOrderFormCommission } from "@/lib/options";
import { createClient } from "@/lib/supabase/server";
import { getPlatformFeeTerms } from "@/lib/platform";
import type { Order, OrderItem } from "@/types/db";
import { OrderForm } from "../../order-form";

export const metadata = { title: "Edit order" };

export default async function EditOrderPage({ params }: PageProps<"/admin/orders/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: orderData }, { data: itemsData }, { products, commission }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id).order("position"),
    getOrderFormCommission(),
  ]);
  if (!orderData) notFound();
  const order = orderData as Order;
  const [{ agentOptions, referralOptions }, platformFee] = await Promise.all([getFormOptions(order.referral_id), getPlatformFeeTerms()]);

  return (
    <>
      <Link href={`/admin/orders/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
        <ArrowLeft className="size-4" /> Order #{order.order_no}
      </Link>
      <PageHeader title={`Edit order #${order.order_no}`} description="Record payments from the order page." />
      <Card className="max-w-4xl p-5">
        <OrderForm
          order={order}
          items={((itemsData ?? []) as OrderItem[]).map((i) => ({
            description: i.description,
            qty: num(i.qty),
            amount: num(i.amount),
            product_id: i.product_id,
            commission_rate: num(i.commission_rate),
          }))}
          agents={agentOptions}
          referrals={referralOptions}
          products={products}
          commission={commission}
          platformFee={platformFee}
          countsForPlatformFee={Boolean(order.public_token)}
          defaults={{}}
        />
      </Card>
    </>
  );
}
