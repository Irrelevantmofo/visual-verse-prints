"use client";

import { useActionState } from "react";
import { submitReferral } from "@/lib/actions/agent";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";

export function ReferralForm({ products }: { products: string[] }) {
  const [state, action, pending] = useActionState(submitReferral, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
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
      <Field label="What do they want printed?" htmlFor="interested_in" className="sm:col-span-2" hint="e.g. 300 cup sleeves for a café opening">
        <input id="interested_in" name="interested_in" list="referral-products" className={inputStyles} />
        <datalist id="referral-products">
          {products.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label="Anything else the shop should know?" htmlFor="notes" className="sm:col-span-2" hint="Deadline, quantity, design ready or not, best time to call.">
        <textarea id="notes" name="notes" rows={4} className={inputStyles} />
      </Field>
      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <button disabled={pending} className={buttonStyles.gold}>
          {pending ? "Sending…" : "Send referral"}
        </button>
      </div>
    </form>
  );
}
