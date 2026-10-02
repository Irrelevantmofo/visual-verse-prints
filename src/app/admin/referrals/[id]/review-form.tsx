"use client";

import { useActionState } from "react";
import { reviewReferral } from "@/lib/actions/admin";
import { buttonStyles, Field, FormMessage, inputStyles } from "@/components/ui";
import type { ReferralStatus } from "@/types/db";

export function ReviewForm({ id, status, notes }: { id: string; status: ReferralStatus; notes: string | null }) {
  const [state, action, pending] = useActionState(reviewReferral, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field
        label="Note to agent"
        htmlFor="review_notes"
        hint="Required when rejecting. The agent sees this."
        error={state?.fieldErrors?.review_notes}
      >
        <textarea id="review_notes" name="review_notes" rows={3} defaultValue={notes ?? ""} className={inputStyles} />
      </Field>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && (
          <button name="decision" value="approved" disabled={pending} className={buttonStyles.gold}>
            Approve referral
          </button>
        )}
        {status !== "rejected" && (
          <button name="decision" value="rejected" disabled={pending} className={buttonStyles.danger}>
            Reject referral
          </button>
        )}
      </div>
    </form>
  );
}
