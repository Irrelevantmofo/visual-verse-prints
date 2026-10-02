"use client";

import { useActionState } from "react";
import { saveSettings } from "@/lib/actions/admin";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";

export function SettingsForm({ ratePct, validityDays, dueSoonDays }: { ratePct: number; validityDays: number; dueSoonDays: number }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Field
        label="Default commission rate (%)"
        htmlFor="default_commission_rate"
        error={fe.default_commission_rate}
        hint="Applies to agents without their own rate. Each order keeps the rate it was created with."
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
      <FormMessage state={state} />
      <button disabled={pending} className={buttonStyles.primary}>
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
