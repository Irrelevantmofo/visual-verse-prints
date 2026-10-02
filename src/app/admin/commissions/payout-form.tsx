"use client";

import { useActionState } from "react";
import { recordPayout } from "@/lib/actions/admin";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";

export function PayoutForm({ agents, today }: { agents: { id: string; name: string; owed: number }[]; today: string }) {
  const [state, action, pending] = useActionState(recordPayout, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Field label="Agent" htmlFor="agent_id" error={fe.agent_id}>
        <select id="agent_id" name="agent_id" required className={inputStyles} defaultValue="">
          <option value="" disabled>
            Choose an agent
          </option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} (owed ₱{a.owed.toFixed(2)})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₱)" htmlFor="amount" error={fe.amount}>
          <input id="amount" name="amount" type="number" min="0.01" step="0.01" required className={cx(inputStyles, "font-mono")} />
        </Field>
        <Field label="Paid on" htmlFor="paid_on" error={fe.paid_on}>
          <input id="paid_on" name="paid_on" type="date" required defaultValue={today} className={inputStyles} />
        </Field>
      </div>
      <Field label="Covers" htmlFor="period_label" hint="e.g. September 2026">
        <input id="period_label" name="period_label" className={inputStyles} />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <input id="notes" name="notes" className={inputStyles} />
      </Field>
      <FormMessage state={state} />
      <button disabled={pending} className={buttonStyles.gold}>
        {pending ? "Recording…" : "Record payout"}
      </button>
    </form>
  );
}
