"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { submitReferral } from "@/lib/actions/agent";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";

const OTHER = "__other__";

type Line = { key: number; productId: string; custom: string; qty: string; details: string };

let nextKey = 1;
const newLine = (): Line => ({ key: nextKey++, productId: "", custom: "", qty: "", details: "" });

export function ReferralForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(submitReferral, null);
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
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
    <form action={action} className="space-y-6">
      <input type="hidden" name="items" value={payload} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" htmlFor="client_name" error={fe.client_name}>
          <input id="client_name" name="client_name" required autoComplete="off" className={inputStyles} />
        </Field>
        <Field label="How to reach them" htmlFor="client_contact" error={fe.client_contact} hint="Mobile number, email or Facebook profile link.">
          <input id="client_contact" name="client_contact" required autoComplete="off" className={inputStyles} />
        </Field>
        <Field label="Business or organization" htmlFor="client_company" hint="Optional">
          <input id="client_company" name="client_company" className={inputStyles} />
        </Field>
        <Field label="Estimated budget (₱)" htmlFor="estimated_budget" hint="Optional" error={fe.estimated_budget}>
          <input id="estimated_budget" name="estimated_budget" type="number" min="0" step="1" className={cx(inputStyles, "font-mono")} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">What do they want printed?</legend>
        <p className="mb-3 text-xs text-graphite">Add each product they need. The shop uses this list for the quote.</p>

        <ul className="space-y-3">
          {lines.map((l, idx) => (
            <li key={l.key} className="rounded-md border border-rule bg-paper/60 p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_7rem_auto]">
                <div>
                  <label htmlFor={`product-${l.key}`} className="mb-1 block text-xs text-graphite">
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
                  <label htmlFor={`qty-${l.key}`} className="mb-1 block text-xs text-graphite">
                    Quantity
                  </label>
                  <input
                    id={`qty-${l.key}`}
                    type="number"
                    min="1"
                    step="any"
                    inputMode="numeric"
                    placeholder="e.g. 300"
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
                  <label htmlFor={`custom-${l.key}`} className="mb-1 block text-xs text-graphite">
                    What is it?
                  </label>
                  <input
                    id={`custom-${l.key}`}
                    value={l.custom}
                    onChange={(e) => update(l.key, { custom: e.target.value })}
                    placeholder="e.g. Menu boards"
                    className={inputStyles}
                  />
                </div>
              )}
              <div className="mt-3">
                <label htmlFor={`details-${l.key}`} className="mb-1 block text-xs text-graphite">
                  Details <span className="text-graphite/70">(optional)</span>
                </label>
                <input
                  id={`details-${l.key}`}
                  value={l.details}
                  onChange={(e) => update(l.key, { details: e.target.value })}
                  placeholder="Size, finish, colors, design ready or not"
                  className={inputStyles}
                />
              </div>
            </li>
          ))}
        </ul>

        <button type="button" onClick={() => setLines((prev) => [...prev, newLine()])} className={cx(buttonStyles.secondary, "mt-3")}>
          <Plus className="size-4" /> Add another product
        </button>
        {itemsError && <p className="mt-2 text-xs text-rose-700">{itemsError}</p>}
      </fieldset>

      <Field label="Anything else the shop should know?" htmlFor="notes" hint="Deadline, best time to call, how they found us.">
        <textarea id="notes" name="notes" rows={3} className={inputStyles} />
      </Field>

      <div className="space-y-3">
        <FormMessage state={state} />
        <button disabled={pending} className={buttonStyles.gold}>
          {pending ? "Sending…" : "Send referral"}
        </button>
      </div>
    </form>
  );
}
