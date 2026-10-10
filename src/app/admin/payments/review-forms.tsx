"use client";

import { useActionState, useState } from "react";
import { approveProof, rejectProof } from "@/lib/actions/payments";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";

/** Verify or reject one customer receipt. */
export function ProofReview({
  proofId,
  claimedAmount,
  balance,
  reference,
  today,
  canVerify,
}: {
  proofId: string;
  claimedAmount: number | null;
  balance: number;
  reference: string | null;
  today: string;
  /** false while the order still needs pricing */
  canVerify: boolean;
}) {
  const [approveState, approve, approving] = useActionState(approveProof, null);
  const [rejectState, reject, rejecting] = useActionState(rejectProof, null);
  const [mode, setMode] = useState<"verify" | "reject">("verify");
  const k = proofId.slice(0, 8);
  const suggested = claimedAmount != null ? Math.min(claimedAmount, Math.max(balance, 0)) : Math.max(balance, 0);

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border border-rule bg-white p-0.5 text-sm" role="tablist" aria-label="Decision">
        {(["verify", "reject"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cx("rounded px-3 py-1.5 font-medium", mode === m ? "bg-ink text-paper" : "text-graphite hover:text-ink")}
          >
            {m === "verify" ? "Verify" : "Reject"}
          </button>
        ))}
      </div>

      {mode === "verify" ? (
        <form action={approve} className="space-y-3">
          <input type="hidden" name="proof_id" value={proofId} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Amount received (₱)" htmlFor={`amt-${k}`} error={approveState?.fieldErrors?.amount} hint="Match it to your bank or e-wallet record.">
              <input
                id={`amt-${k}`}
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={suggested > 0 ? suggested.toFixed(2) : ""}
                className={cx(inputStyles, "font-mono")}
              />
            </Field>
            <Field label="Date received" htmlFor={`date-${k}`} error={approveState?.fieldErrors?.paid_on}>
              <input id={`date-${k}`} name="paid_on" type="date" required defaultValue={today} className={inputStyles} />
            </Field>
            <Field label="Reference" htmlFor={`ref-${k}`}>
              <input id={`ref-${k}`} name="reference" defaultValue={reference ?? ""} className={cx(inputStyles, "font-mono")} />
            </Field>
          </div>
          <FormMessage state={approveState} />
          <button disabled={approving || !canVerify} className={buttonStyles.gold}>
            {approving ? "Recording…" : "Verify and record payment"}
          </button>
          {!canVerify && <p className="text-xs text-graphite">Confirm this order&apos;s price first.</p>}
        </form>
      ) : (
        <form action={reject} className="space-y-3">
          <input type="hidden" name="proof_id" value={proofId} />
          <Field
            label="What's wrong with it?"
            htmlFor={`note-${k}`}
            error={rejectState?.fieldErrors?.review_note}
            hint="The customer sees this on their order page and can upload again."
          >
            <textarea
              id={`note-${k}`}
              name="review_note"
              rows={2}
              required
              placeholder="e.g. We can't find this payment. Please send the confirmation screen showing the reference number."
              className={inputStyles}
            />
          </Field>
          <FormMessage state={rejectState} />
          <button disabled={rejecting} className={buttonStyles.danger}>
            {rejecting ? "Rejecting…" : "Reject receipt"}
          </button>
        </form>
      )}
    </div>
  );
}
