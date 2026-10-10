"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createWebOrder } from "@/lib/actions/ordering";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";
import { php } from "@/lib/format";
import { FULFILMENT } from "@/lib/labels";
import type { FulfilmentMethod } from "@/types/db";

const OTHER = "__other__";

export type OrderableProduct = {
  id: string;
  name: string;
  /** exact price per unit when the product is fixed-price; null = the shop quotes it */
  price: number | null;
  unit: string | null;
};

type Line = { key: number; productId: string; custom: string; qty: string; details: string; customSpec: boolean };

let nextKey = 1;
const newLine = (productId = ""): Line => ({ key: nextKey++, productId, custom: "", qty: "", details: "", customSpec: false });

export function WebOrderForm({
  products,
  preselect,
  refCode,
  pickupName,
  leadTime,
  facebookUrl,
}: {
  products: OrderableProduct[];
  preselect?: string;
  refCode?: string;
  pickupName: string;
  leadTime: string;
  facebookUrl: string;
}) {
  const [state, action, pending] = useActionState(createWebOrder, null);
  const [lines, setLines] = useState<Line[]>(() => [newLine(preselect && products.some((p) => p.id === preselect) ? preselect : "")]);
  const [fulfilment, setFulfilment] = useState<FulfilmentMethod>("pickup");
  const fe = state?.fieldErrors ?? {};

  const update = (key: number, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const productOf = (l: Line) => products.find((p) => p.id === l.productId);
  /** Price for a line that can be paid right away, or null when the shop has to quote it. */
  const linePrice = (l: Line) => {
    const p = productOf(l);
    if (!p || p.price == null || l.customSpec) return null;
    return Math.round(p.price * (Number(l.qty) || 1) * 100) / 100;
  };

  const chosen = lines.filter((l) => l.productId);
  const prices = chosen.map(linePrice);
  const allPriced = chosen.length > 0 && prices.every((p) => p !== null);
  const payNow = allPriced && fulfilment !== "courier";
  const knownTotal = prices.reduce<number>((sum, p) => sum + (p ?? 0), 0);

  const payload = JSON.stringify(
    chosen.map((l) => {
      const product = productOf(l);
      return {
        product_id: product ? product.id : null,
        description: product ? product.name : l.custom,
        qty: l.qty || "1",
        details: l.details,
        custom_spec: !!product && product.price != null && l.customSpec,
      };
    }),
  );
  const itemsError = Object.entries(fe).find(([k]) => k === "items" || k.startsWith("items."))?.[1];

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="items" value={payload} />
      {refCode && <input type="hidden" name="ref" value={refCode} />}
      {/* Honeypot: hidden from people, tempting to bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset>
        <legend className="font-display text-2xl font-semibold uppercase">What would you like printed?</legend>
        <p className="mt-1 mb-4 text-sm text-graphite">
          Items with a listed price can be paid right away. For everything else, we confirm the price first.
        </p>

        <ul className="space-y-3">
          {lines.map((l, idx) => {
            const product = productOf(l);
            const price = linePrice(l);
            return (
              <li key={l.key} className="rounded-lg border border-rule bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
                  <div>
                    <label htmlFor={`product-${l.key}`} className="mb-1 block text-sm font-medium">
                      Product {lines.length > 1 ? idx + 1 : ""}
                    </label>
                    <select
                      id={`product-${l.key}`}
                      value={l.productId}
                      onChange={(e) => update(l.key, { productId: e.target.value, customSpec: false })}
                      className={inputStyles}
                    >
                      <option value="">Choose a product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.price != null ? ` (${php(p.price)}${p.unit ? ` ${p.unit}` : ""})` : ""}
                        </option>
                      ))}
                      <option value={OTHER}>Something else…</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`qty-${l.key}`} className="mb-1 block text-sm font-medium">
                      Quantity
                    </label>
                    <input
                      id={`qty-${l.key}`}
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="e.g. 100"
                      value={l.qty}
                      onChange={(e) => update(l.key, { qty: e.target.value })}
                      className={cx(inputStyles, "font-mono")}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                      disabled={lines.length === 1}
                      className={cx(buttonStyles.ghost, "px-2")}
                      aria-label={`Remove product ${idx + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {l.productId === OTHER && (
                  <div className="mt-3">
                    <label htmlFor={`custom-${l.key}`} className="mb-1 block text-sm font-medium">
                      What is it?
                    </label>
                    <input
                      id={`custom-${l.key}`}
                      value={l.custom}
                      onChange={(e) => update(l.key, { custom: e.target.value })}
                      placeholder="e.g. Menu boards"
                      maxLength={120}
                      className={inputStyles}
                    />
                  </div>
                )}

                {product?.price != null && (
                  <label className="mt-3 flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={l.customSpec}
                      onChange={(e) => update(l.key, { customSpec: e.target.checked })}
                      className="mt-0.5 size-4 accent-[var(--color-foil-dark)]"
                    />
                    <span>I need a different size or spec than listed</span>
                  </label>
                )}

                <div className="mt-3">
                  <label htmlFor={`details-${l.key}`} className="mb-1 block text-sm font-medium">
                    {l.customSpec ? "Size or spec you need" : "Details"}{" "}
                    {!l.customSpec && <span className="font-normal text-graphite">(optional)</span>}
                  </label>
                  <input
                    id={`details-${l.key}`}
                    value={l.details}
                    onChange={(e) => update(l.key, { details: e.target.value })}
                    required={l.customSpec}
                    placeholder={l.customSpec ? "e.g. 750ml instead of 500ml" : "Finish, colors, is your design ready?"}
                    maxLength={300}
                    className={inputStyles}
                  />
                </div>

                {l.productId && (
                  <p className="mt-3 text-sm">
                    {price !== null ? (
                      <>
                        <span className="text-graphite">Price: </span>
                        <span className="font-mono font-medium">{php(price)}</span>
                      </>
                    ) : (
                      <span className="text-foil-dark">We&apos;ll confirm the price for this item.</span>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <button type="button" onClick={() => setLines((prev) => [...prev, newLine()])} className={cx(buttonStyles.secondary, "mt-3")}>
          <Plus className="size-4" /> Add another product
        </button>
        {itemsError && <p className="mt-2 text-sm text-rose-700">{itemsError}</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-4 font-display text-2xl font-semibold uppercase">How will you get it?</legend>
        <div className="space-y-2">
          {(Object.keys(FULFILMENT) as FulfilmentMethod[]).map((m) => (
            <label
              key={m}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-4",
                fulfilment === m ? "border-foil ring-2 ring-foil/30" : "border-rule",
              )}
            >
              <input
                type="radio"
                name="fulfilment"
                value={m}
                checked={fulfilment === m}
                onChange={() => setFulfilment(m)}
                className="mt-1 size-4 accent-[var(--color-foil-dark)]"
              />
              <span className="text-sm">
                <span className="block font-medium">{FULFILMENT[m].label}</span>
                <span className="block text-graphite">
                  {m === "pickup" && "Collect it from our shop in Caloocan. We'll tell you when it's ready."}
                  {m === "lalamove" && (
                    <>
                      When your order is ready, book a Lalamove rider yourself and pay the rider. Use{" "}
                      <span className="font-medium text-ink">&ldquo;{pickupName}&rdquo;</span> as the pick-up point.
                    </>
                  )}
                  {m === "courier" && "For areas far from Caloocan. You cover the shipping fee; we'll add it when we confirm your order."}
                </span>
              </span>
            </label>
          ))}
        </div>
        {fe.fulfilment && <p className="mt-2 text-sm text-rose-700">{fe.fulfilment}</p>}

        {fulfilment === "courier" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Recipient's name" htmlFor="delivery_name" error={fe.delivery_name}>
              <input id="delivery_name" name="delivery_name" required maxLength={100} autoComplete="name" className={inputStyles} />
            </Field>
            <Field label="Recipient's mobile number" htmlFor="delivery_phone" error={fe.delivery_phone}>
              <input id="delivery_phone" name="delivery_phone" required maxLength={40} autoComplete="tel" inputMode="tel" className={inputStyles} />
            </Field>
            <Field
              label="Delivery address"
              htmlFor="delivery_address"
              error={fe.delivery_address}
              className="sm:col-span-2"
              hint="House or unit number, street, barangay, city, province and ZIP code."
            >
              <textarea id="delivery_address" name="delivery_address" required rows={3} maxLength={400} autoComplete="street-address" className={inputStyles} />
            </Field>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-4 font-display text-2xl font-semibold uppercase">Your details</legend>
        <Field label="Name" htmlFor="client_name" error={fe.client_name}>
          <input id="client_name" name="client_name" required autoComplete="name" maxLength={100} className={inputStyles} />
        </Field>
        <Field label="Mobile number or email" htmlFor="client_contact" error={fe.client_contact} hint="So we can reach you about your order.">
          <input id="client_contact" name="client_contact" required autoComplete="tel" maxLength={120} className={inputStyles} />
        </Field>
        <Field label="Anything else we should know?" htmlFor="customer_notes" className="sm:col-span-2" hint="Deadline or special requests.">
          <textarea id="customer_notes" name="customer_notes" rows={3} maxLength={1000} className={inputStyles} />
        </Field>
      </fieldset>

      <div className="rounded-lg border border-rule bg-white p-4 text-sm">
        {chosen.length === 0 ? (
          <p className="text-graphite">Choose a product to see what happens next.</p>
        ) : payNow ? (
          <p>
            <span className="font-medium">Total: </span>
            <span className="font-mono text-base font-semibold">{php(knownTotal)}</span>
            <span className="block text-graphite">You can pay right after sending this order. Full payment is required before we start printing.</span>
          </p>
        ) : (
          <p>
            <span className="font-medium">We&apos;ll confirm your total first.</span>
            <span className="block text-graphite">
              {fulfilment === "courier" && allPriced
                ? `Your items come to ${php(knownTotal)}. We'll add the shipping fee, then you can pay.`
                : "Some items need a price from us. You'll see the total on your order page, then you can pay."}
            </span>
          </p>
        )}
        <p className="mt-3 border-t border-rule pt-3 text-graphite">
          <span className="font-medium text-ink">Lead time: {leadTime}.</span> Need it sooner?{" "}
          <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
            Message us on Facebook
          </a>{" "}
          to check if a rush is possible.
        </p>
      </div>

      <div className="space-y-3">
        <FormMessage state={state} />
        <button disabled={pending} className={cx(buttonStyles.gold, "w-full py-3 text-base sm:w-auto sm:px-8")}>
          {pending ? "Sending your order…" : "Send order"}
        </button>
        <p className="text-xs text-graphite">You&apos;ll get a private link to track this order, upload your design and pay.</p>
      </div>
    </form>
  );
}
