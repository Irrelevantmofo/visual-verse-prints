import { MessageCircle } from "lucide-react";
import { getCatalog, SHOP } from "@/lib/catalog";
import { isOrderingEnabled } from "@/lib/ordering";
import { WebOrderForm } from "./order-form";

export const metadata = { title: "Order online" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ searchParams }: PageProps<"/order">) {
  const { product } = await searchParams;
  const [enabled, products] = await Promise.all([isOrderingEnabled(), getCatalog()]);

  if (!enabled) {
    return (
      <div className="py-10 text-center">
        <h1 className="font-display text-4xl font-bold uppercase">Online ordering is coming soon</h1>
        <p className="mx-auto mt-3 max-w-md text-graphite">Until then, message us with what you need and we&apos;ll take your order.</p>
        <a
          href={SHOP.messengerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 font-medium text-paper hover:bg-ink-3"
        >
          <MessageCircle className="size-4" aria-hidden />
          Order through Messenger
        </a>
      </div>
    );
  }

  const preselect = typeof product === "string" ? products.find((p) => p.slug === product)?.id : undefined;

  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase sm:text-5xl">Order online</h1>
      <p className="mt-2 mb-8 text-graphite">Tell us what you need. We&apos;ll confirm the price, then you pay by QR and upload your receipt.</p>
      <WebOrderForm products={products.map((p) => ({ id: p.id, name: p.name }))} preselect={preselect} />
    </>
  );
}
