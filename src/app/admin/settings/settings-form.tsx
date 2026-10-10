"use client";

import { useActionState } from "react";
import { saveSettings } from "@/lib/actions/admin";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";

export function SettingsForm({
  ratePct,
  validityDays,
  dueSoonDays,
  orderingEnabled,
  activeChannels,
}: {
  ratePct: number;
  validityDays: number;
  dueSoonDays: number;
  orderingEnabled: boolean;
  activeChannels: number;
}) {
  const [state, action, pending] = useActionState(saveSettings, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Field
        label="Default commission rate (%)"
        htmlFor="default_commission_rate"
        error={fe.default_commission_rate}
        hint="Used on order lines when neither the product nor the agent has a rate. Each order keeps the rates it was saved with."
      >
        <input
          id="default_commission_rate"
          name="default_commission_rate"
          type="number"
          min="0"
          max="100"
          step="0.1"
          defaultValue={ratePct}
          className={cx(inputStyles, "w-32 font-mono")}
        />
      </Field>
      <Field label="Quotes are valid for (days)" htmlFor="quote_validity_days" error={fe.quote_validity_days}>
        <input
          id="quote_validity_days"
          name="quote_validity_days"
          type="number"
          min="1"
          defaultValue={validityDays}
          className={cx(inputStyles, "w-32 font-mono")}
        />
      </Field>
      <Field
        label="Flag quotes as “Due Soon” within (days)"
        htmlFor="due_soon_days"
        error={fe.due_soon_days}
      >
        <input id="due_soon_days" name="due_soon_days" type="number" min="0" defaultValue={dueSoonDays} className={cx(inputStyles, "w-32 font-mono")} />
      </Field>
      <div className="rounded-md border border-rule bg-paper p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="online_ordering_enabled"
            defaultChecked={orderingEnabled}
            className="mt-1 size-4 accent-[var(--color-foil-dark)]"
          />
          <span>
            <span className="block text-sm font-medium">Accept orders on the website</span>
            <span className="block text-xs text-graphite">
              Shows an Order button on the site. Customers send an order, you confirm the price, then they pay by QR and upload a receipt for you to
              verify.
            </span>
          </span>
        </label>
        {activeChannels === 0 && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            No payment channel is set up yet. Add at least one (with its QR) so customers know where to pay.
          </p>
        )}
      </div>
      <FormMessage state={state} />
      <button disabled={pending} className={buttonStyles.primary}>
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
