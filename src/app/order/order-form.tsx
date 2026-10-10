"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createWebOrder } from "@/lib/actions/ordering";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";

const OTHER = "__other__";

type Line = { key: number; productId: string; custom: string; qty: string; details: string };

let nextKey = 1;
const newLine = (productId = ""): Line => ({ key: nextKey++, productId, custom: "", qty: "", details: "" });

export function WebOrderForm({ products, preselect }: { products: { id: string; name: string }[]; preselect?: string }) {
  const [state, action, pending] = useActionState(createWebOrder, null);
  const [lines, setLines] = useState<Line[]>(() => [newLine(preselect && products.some((p) => p.id === preselect) ? preselect : "")]);
  const fe = state?.fieldErrors ?? {};

  const update = (key: number, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const payload = JSON.stringify(
    lines
      .filter((l) => l.productId)
      .map((l) => {
        const product = products.find((p) => p.id === l.productId);
        return {
          product_id: product ? product.id : null,
          description: product ? product.name : l.custom,
          qty: l.qty || "1",
          details: l.details,
        };
      }),
  );
  const itemsError = Object.entries(fe).find(([k]) => k === "items" || k.startsWith("items."))?.[1];

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="items" value={payload} />
      {/* Honeypot: hidden from people, tempting to bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset>
        <legend className="font-display text-2xl font-semibold uppercase">What would you like printed?</legend>
        <p className="mt-1 mb-4 text-sm text-graphite">Add each product you need. We&apos;ll confirm the price before you pay.</p>

        <ul className="space-y-3">
          {lines.map((l, idx) => (
            <li key={l.key} className="rounded-lg border border-rule bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
                <div>
                  <label htmlFor={`product-${l.key}`} className="mb-1 block text-sm font-medium">
                    Product {lines.length > 1 ? idx + 1 : ""}
                  </label>
                  <select
                    id={`product-${l.key}`}
                    value={l.productId}
                    onChange={(e) => update(l.key, { productId: e.target.value })}
                    className={inputStyles}
                  >
                    <option value="">Choose a product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
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
                    step="any"
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
              <div className="mt-3">
                <label htmlFor={`details-${l.key}`} className="mb-1 block text-sm font-medium">
                  Details <span className="font-normal text-graphite">(optional)</span>
                </label>
                <input
                  id={`details-${l.key}`}
                  value={l.details}
                  onChange={(e) => update(l.key, { details: e.target.value })}
                  placeholder="Size, finish, colors, is your design ready?"
                  maxLength={300}
                  className={inputStyles}
                />
              </div>
            </li>
          ))}
        </ul>

        <button type="button" onClick={() => setLines((prev) => [...prev, newLine()])} className={cx(buttonStyles.secondary, "mt-3")}>
          <Plus className="size-4" /> Add another product
        </button>
        {itemsError && <p className="mt-2 text-sm text-rose-700">{itemsError}</p>}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-4 font-display text-2xl font-semibold uppercase">Your details</legend>
        <Field label="Name" htmlFor="client_name" error={fe.client_name}>
          <input id="client_name" name="client_name" required autoComplete="name" maxLength={100} className={inputStyles} />
        </Field>
        <Field label="Mobile number or email" htmlFor="client_contact" error={fe.client_contact} hint="So we can reach you about your order.">
          <input id="client_contact" name="client_contact" required autoComplete="tel" maxLength={120} className={inputStyles} />
        </Field>
        <Field label="Anything else we should know?" htmlFor="customer_notes" className="sm:col-span-2" hint="Deadline, pick-up or delivery, special requests.">
          <textarea id="customer_notes" name="customer_notes" rows={3} maxLength={1000} className={inputStyles} />
        </Field>
      </fieldset>

      <div className="space-y-3">
        <FormMessage state={state} />
        <button disabled={pending} className={cx(buttonStyles.gold, "w-full py-3 text-base sm:w-auto sm:px-8")}>
          {pending ? "Sending your order…" : "Send order"}
        </button>
        <p className="text-xs text-graphite">No payment yet. You&apos;ll get a private link to track this order and pay once we confirm the price.</p>
      </div>
    </form>
  );
}
