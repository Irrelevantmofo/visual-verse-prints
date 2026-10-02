import Link from "next/link";
import { Badge, Card, CardHeader, PageHeader, buttonStyles } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteProduct } from "@/lib/actions/admin";
import { num, pct, phpShort } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/db";
import { ProductForm } from "./product-form";

export const metadata = { title: "Catalog" };

export default async function CatalogPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").order("sort_order");
  const products = (data ?? []) as Product[];
  const nextSort = (products.at(-1)?.sort_order ?? 0) + 10;

  return (
    <>
      <PageHeader
        title="Catalog"
        description={
          <>
            What appears under &ldquo;What we print&rdquo; on the{" "}
            <Link href="/#services" className="underline" target="_blank">
              website
            </Link>
            . These also become the products for online ordering later.
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <Card>
          <CardHeader title={`${products.length} products`} />
          <ul className="divide-y divide-rule">
            {products.map((p) => (
              <li key={p.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 hover:bg-paper">
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-graphite">{p.category}</span>
                    </span>
                    <span className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-graphite">{p.starting_price != null ? `from ${phpShort(p.starting_price)}` : "quote"}</span>
                      <Badge tone={p.commission_rate != null ? "gold" : "neutral"}>
                        {p.commission_rate != null ? `${pct(num(p.commission_rate))} agent` : "agent rate"}
                      </Badge>
                      {!p.active && <Badge tone="neutral">Hidden</Badge>}
                    </span>
                  </summary>
                  <div className="space-y-4 border-t border-rule bg-paper/50 px-5 py-4">
                    <ProductForm product={p} />
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton message={`Delete ${p.name}? Uncheck "Show on website" to just hide it.`} className={buttonStyles.danger}>
                        Delete product
                      </ConfirmButton>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Add product" />
          <div className="p-5">
            <ProductForm nextSort={nextSort} />
          </div>
        </Card>
      </div>
    </>
  );
}
