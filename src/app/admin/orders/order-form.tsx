"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveOrder } from "@/lib/actions/admin";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";
import { DELIVERY_STATUS, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/labels";
import { pct, php } from "@/lib/format";
import type { Order, Product } from "@/types/db";

type Option = { id: string; label: string; agentId?: string; clientName?: string; clientContact?: string };
type Item = {
  description: string;
  qty: string;
  amount: string;
  product_id: string | null;
  /** commission %, as typed */
  rate: string;
  /** admin typed a rate by hand; don't overwrite it from defaults */
  rateTouched: boolean;
};

export type CommissionDefaults = {
  defaultRate: number;
  agentRates: Record<string, number | null>;
};

const toPct = (fraction: number) => String(+(fraction * 100).toFixed(2));

export function OrderForm({
  order,
  items: initialItems,
  agents,
  referrals,
  products,
  defaults,
  commission,
  prefillItems,
}: {
  order?: Order;
  items?: { description: string; qty: number; amount: number; product_id: string | null; commission_rate: number }[];
  agents: Option[];
  referrals: Option[];
  products: Pick<Product, "id" | "name" | "commission_rate">[];
  defaults: Partial<Order> & { quoted_amount?: number; description?: string | null };
  commission: CommissionDefaults;
  /** Lines requested on the referral; the admin adds prices. */
  prefillItems?: { description: string; qty: number; product_id: string | null }[];
}) {
  const [state, action, pending] = useActionState(saveOrder, null);
  const v = { ...defaults, ...order };
  const [referralId, setReferralId] = useState(v.referral_id ?? "");
  const [agentId, setAgentId] = useState(v.agent_id ?? "");
  const [source, setSource] = useState(v.source ?? (v.referral_id || v.agent_id ? "referral" : "direct"));
  const [clientName, setClientName] = useState(v.client_name ?? "");
  const [clientContact, setClientContact] = useState(v.client_contact ?? "");
  /** Default line rate: product → agent → shop default (same order as the database trigger). */
  const defaultRateFor = (productId: string | null, agent: string) => {
    const productRate = products.find((p) => p.id === productId)?.commission_rate;
    if (productRate != null) return productRate;
    const agentRate = agent ? commission.agentRates[agent] : null;
    return agentRate ?? commission.defaultRate;
  };

  const [items, setItems] = useState<Item[]>(() =>
    initialItems?.length
      ? initialItems.map((i) => ({
          description: i.description,
          qty: String(i.qty),
          amount: String(i.amount),
          product_id: i.product_id,
          rate: toPct(i.commission_rate),
          rateTouched: true,
        }))
      : prefillItems?.length
        ? prefillItems.map((i) => ({
            description: i.description,
            qty: String(i.qty),
            amount: "",
            product_id: i.product_id,
            rate: toPct(defaultRateFor(i.product_id, v.agent_id ?? "")),
            rateTouched: false,
          }))
        : [
          {
            description: defaults.description ?? "",
            qty: "1",
            amount: defaults.quoted_amount != null ? String(defaults.quoted_amount) : "",
            product_id: null,
            rate: toPct(defaultRateFor(null, v.agent_id ?? "")),
            rateTouched: false,
          },
        ],
  );
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const lineCommission = (i: Item) => ((Number(i.amount) || 0) * (Number(i.rate) || 0)) / 100;
  const commissionTotal = agentId ? items.reduce((s, i) => s + lineCommission(i), 0) : 0;

  const changeAgent = (id: string) => {
    setAgentId(id);
    // Lines the admin hasn't set by hand follow the new agent's default
    setItems((prev) => prev.map((it) => (it.rateTouched ? it : { ...it, rate: toPct(defaultRateFor(it.product_id, id)) })));
  };
  const fe = state?.fieldErrors ?? {};

  const setItem = (idx: number, patch: Partial<Item>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const onReferral = (id: string) => {
    setReferralId(id);
    const r = referrals.find((x) => x.id === id);
    if (r) {
      setSource("referral");
      if (r.agentId) changeAgent(r.agentId);
      if (r.clientName) setClientName(r.clientName);
      if (r.clientContact) setClientContact(r.clientContact);
    }
  };

  const payload = JSON.stringify(
    items
      .filter((i) => i.description.trim() || i.amount)
      .map((i) => ({
        description: i.description,
        qty: i.qty || "1",
        amount: i.amount || "0",
        product_id: i.product_id || null,
        commission_pct: i.rate === "" ? "0" : i.rate,
      })),
  );

  return (
    <form action={action} className="space-y-6">
      {order && <input type="hidden" name="id" value={order.id} />}
      {v.quotation_id && <input type="hidden" name="quotation_id" value={v.quotation_id} />}
      <input type="hidden" name="items" value={payload} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-lg font-semibold uppercase">Client</legend>
        <Field label="Referral" htmlFor="referral_id" hint="Credits the order to the referring agent." className="sm:col-span-2">
          <select id="referral_id" name="referral_id" value={referralId} onChange={(e) => onReferral(e.target.value)} className={inputStyles}>
            <option value="">No referral</option>
            {referrals.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Client name" htmlFor="client_name" error={fe.client_name}>
          <input id="client_name" name="client_name" required value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputStyles} />
        </Field>
        <Field label="Client contact" htmlFor="client_contact">
          <input id="client_contact" name="client_contact" value={clientContact} onChange={(e) => setClientContact(e.target.value)} className={inputStyles} />
        </Field>
        <Field label="Source" htmlFor="source">
          <select id="source" name="source" value={source} onChange={(e) => setSource(e.target.value as Order["source"])} className={inputStyles}>
            <option value="referral">Agent referral</option>
            <option value="direct">Direct / walk-in</option>
            <option value="website">Website</option>
          </select>
        </Field>
        <Field label="Agent" htmlFor="agent_id" hint={referralId ? "Set by the referral." : "Earns commission on what the client pays."}>
          <select id="agent_id" name="agent_id" value={agentId} disabled={!!referralId} onChange={(e) => changeAgent(e.target.value)} className={inputStyles}>
            <option value="">No agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          {referralId && <input type="hidden" name="agent_id" value={agentId} />}
        </Field>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-display text-lg font-semibold uppercase">Items</legend>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left font-mono text-[0.68rem] tracking-wider text-graphite uppercase">
                <th className="pb-2 font-medium">Item</th>
                <th className="w-24 pb-2 font-medium">Qty</th>
                <th className="w-36 pb-2 font-medium">Line total (₱)</th>
                <th className="w-28 pb-2 font-medium">Agent %</th>
                <th className="w-28 pb-2 text-right font-medium">Commission</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Item ${idx + 1} description`}
                      list="product-names"
                      value={it.description}
                      onChange={(e) => {
                        const match = products.find((p) => p.name === e.target.value);
                        if (match && match.id !== it.product_id) {
                          // Picked a different catalog product: link it and apply its rate
                          setItem(idx, {
                            description: e.target.value,
                            product_id: match.id,
                            rate: toPct(defaultRateFor(match.id, agentId)),
                            rateTouched: false,
                          });
                        } else {
                          // Free-text edits keep the line's product and rate
                          setItem(idx, { description: e.target.value });
                        }
                      }}
                      placeholder="e.g. Laminated calling cards"
                      className={inputStyles}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Item ${idx + 1} quantity`}
                      type="number"
                      min="0.01"
                      step="any"
                      value={it.qty}
                      onChange={(e) => setItem(idx, { qty: e.target.value })}
                      className={cx(inputStyles, "font-mono")}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Item ${idx + 1} line total`}
                      type="number"
                      required={it.description.trim() !== ""}
                      placeholder="Price"
                      min="0"
                      step="0.01"
                      value={it.amount}
                      onChange={(e) => setItem(idx, { amount: e.target.value })}
                      className={cx(inputStyles, "font-mono")}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <div className="relative">
                      <input
                        aria-label={`Item ${idx + 1} agent commission percent`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={it.rate}
                        disabled={!agentId}
                        onChange={(e) => setItem(idx, { rate: e.target.value, rateTouched: true })}
                        className={cx(inputStyles, "pr-7 font-mono")}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-graphite">%</span>
                    </div>
                  </td>
                  <td className={cx("py-1 pr-2 text-right font-mono", !agentId && "text-graphite/50")}>
                    {agentId ? php(lineCommission(it)) : "—"}
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))}
                      disabled={items.length === 1}
                      className={cx(buttonStyles.ghost, "px-2")}
                      aria-label={`Remove item ${idx + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <datalist id="product-names">
          {products.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              setItems((prev) => [
                ...prev,
                { description: "", qty: "1", amount: "", product_id: null, rate: toPct(defaultRateFor(null, agentId)), rateTouched: false },
              ])
            }
            className={buttonStyles.secondary}
          >
            <Plus className="size-4" /> Add item
          </button>
          <div className="text-right text-sm">
            <p>
              Order total <span className="ml-2 font-mono text-base font-semibold">{php(total)}</span>
            </p>
            <p className="mt-0.5 text-graphite">
              {agentId ? (
                <>
                  Agent commission{" "}
                  <span className="ml-2 font-mono text-ink">{php(commissionTotal)}</span>
                  {total > 0 && <span className="ml-1 text-xs">({pct(commissionTotal / total)} overall)</span>}
                </>
              ) : (
                "No agent, so no commission"
              )}
            </p>
          </div>
        </div>
        {agentId && (
          <p className="mt-2 text-xs text-graphite">
            Each line starts at the product&apos;s commission rate, or the agent&apos;s rate if the product has none. Change any line as needed. The agent earns
            it as the client pays.
          </p>
        )}
        {fe.items && <p className="mt-1 text-xs text-rose-700">{fe.items}</p>}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 font-display text-lg font-semibold uppercase">Status</legend>
        <Field label="Order date" htmlFor="order_date" error={fe.order_date}>
          <input id="order_date" name="order_date" type="date" required defaultValue={v.order_date ?? ""} className={inputStyles} />
        </Field>
        <Field label="Order status" htmlFor="order_status">
          <select id="order_status" name="order_status" defaultValue={v.order_status ?? "in_progress"} className={inputStyles}>
            {Object.entries(ORDER_STATUS).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Delivery status" htmlFor="delivery_status">
          <select id="delivery_status" name="delivery_status" defaultValue={v.delivery_status ?? "in_progress"} className={inputStyles}>
            {Object.entries(DELIVERY_STATUS).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      {!order && (
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-3 font-display text-lg font-semibold uppercase">Payment received</legend>
          <Field label="Amount paid now (₱)" htmlFor="initial_payment" hint="Leave blank if unpaid. Add more payments later.">
            <input id="initial_payment" name="initial_payment" type="number" min="0" step="0.01" className={cx(inputStyles, "font-mono")} />
          </Field>
          <Field label="Method" htmlFor="payment_method">
            <select id="payment_method" name="payment_method" defaultValue="gcash" className={inputStyles}>
              {Object.entries(PAYMENT_METHOD).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </fieldset>
      )}

      <Field label="Notes" htmlFor="notes">
        <textarea id="notes" name="notes" rows={3} defaultValue={v.notes ?? ""} className={inputStyles} />
      </Field>

      <div className="space-y-3">
        <FormMessage state={state} />
        <button disabled={pending} className={buttonStyles.primary}>
          {pending ? "Saving…" : order ? "Save order" : "Create order"}
        </button>
      </div>
    </form>
  );
}
