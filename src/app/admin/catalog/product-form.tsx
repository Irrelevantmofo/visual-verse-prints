"use client";

import { useActionState } from "react";
import { saveProduct } from "@/lib/actions/admin";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";
import { ImageGalleryUpload } from "@/components/staff/image-upload";
import { productPhotos } from "@/lib/images";
import type { Product } from "@/types/db";

export function ProductForm({ product, nextSort }: { product?: Product; nextSort?: number }) {
  const [state, action, pending] = useActionState(saveProduct, null);
  const fe = state?.fieldErrors ?? {};
  const k = product?.id.slice(0, 8) ?? "new";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {product && <input type="hidden" name="id" value={product.id} />}
      <Field label="Name" htmlFor={`name-${k}`} error={fe.name}>
        <input id={`name-${k}`} name="name" required defaultValue={product?.name} className={inputStyles} />
      </Field>
      <Field label="URL slug" htmlFor={`slug-${k}`} error={fe.slug}>
        <input id={`slug-${k}`} name="slug" required defaultValue={product?.slug} className={cx(inputStyles, "font-mono")} />
      </Field>
      <Field label="Category" htmlFor={`cat-${k}`} error={fe.category}>
        <input id={`cat-${k}`} name="category" required defaultValue={product?.category ?? "Print"} className={inputStyles} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (₱)" htmlFor={`price-${k}`} hint="Blank = quote" error={fe.starting_price}>
          <input
            id={`price-${k}`}
            name="starting_price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.starting_price ?? ""}
            className={cx(inputStyles, "font-mono")}
          />
        </Field>
        <Field label="Unit" htmlFor={`unit-${k}`}>
          <input id={`unit-${k}`} name="unit" placeholder="per piece" defaultValue={product?.unit ?? ""} className={inputStyles} />
        </Field>
      </div>
      <Field label="Description" htmlFor={`desc-${k}`} className="sm:col-span-2">
        <textarea id={`desc-${k}`} name="description" rows={2} defaultValue={product?.description ?? ""} className={inputStyles} />
      </Field>
      <Field
        label="Agent commission (%)"
        htmlFor={`comm-${k}`}
        hint="Pre-fills this product's lines on orders. Blank uses the agent's rate."
        error={fe.commission_rate}
      >
        <input
          id={`comm-${k}`}
          name="commission_rate"
          type="number"
          min="0"
          max="100"
          step="0.1"
          defaultValue={product?.commission_rate != null ? +(product.commission_rate * 100).toFixed(2) : ""}
          className={cx(inputStyles, "font-mono")}
        />
      </Field>
      <div className="sm:col-span-2">
        <p className="mb-2 text-sm font-medium">Photos of finished work</p>
        <ImageGalleryUpload
          name="image_urls"
          initialUrls={product ? productPhotos(product) : []}
          legacyLink={product?.image_url ?? null}
          alt={product?.name ?? "New product"}
        />
        {fe.image_urls && <p className="mt-1 text-xs text-rose-700">{fe.image_urls}</p>}
      </div>
      <div className="flex items-end gap-4">
        <Field label="Order" htmlFor={`sort-${k}`}>
          <input
            id={`sort-${k}`}
            name="sort_order"
            type="number"
            defaultValue={product?.sort_order ?? nextSort ?? 0}
            className={cx(inputStyles, "w-24 font-mono")}
          />
        </Field>
        <label className="inline-flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="size-4 accent-[var(--color-foil-dark)]" />
          Show on website
        </label>
      </div>
      <div className="rounded-md border border-rule bg-white p-3 sm:col-span-2">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="fixed_price"
            defaultChecked={product?.fixed_price ?? false}
            className="mt-1 size-4 accent-[var(--color-foil-dark)]"
          />
          <span>
            <span className="block text-sm font-medium">Fixed price: customers can order and pay right away</span>
            <span className="block text-xs text-graphite">
              The price above is charged per unit, as listed. Leave this off for items you quote per job. A customer who asks for a different size
              still waits for your price.
            </span>
          </span>
        </label>
        {fe.fixed_price && <p className="mt-1 text-xs text-rose-700">{fe.fixed_price}</p>}
      </div>
      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <button disabled={pending} className={product ? buttonStyles.secondary : buttonStyles.primary}>
          {pending ? "Saving…" : product ? "Save product" : "Add product"}
        </button>
      </div>
    </form>
  );
}
