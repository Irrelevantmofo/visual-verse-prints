import { Check, X } from "lucide-react";
import { cx } from "@/components/ui";
import { REFERRAL_STAGE, REFERRAL_STEPS } from "@/lib/labels";
import type { ReferralStage } from "@/types/db";

/** Stepper showing where a referral is: Submitted → Approved → Quoted → In production → Ready → Delivered. */
export function ReferralProgress({ stage, compact = false }: { stage: ReferralStage; compact?: boolean }) {
  const stopped = stage === "rejected" || stage === "lost";
  // "lost" stopped after quoting; "rejected" stopped at review.
  const reachedIndex = stopped
    ? stage === "lost"
      ? REFERRAL_STEPS.findIndex((s) => s.key === "quoted")
      : 0
    : REFERRAL_STEPS.findIndex((s) => s.key === stage);

  if (compact) {
    return (
      <div className="flex items-center gap-1" aria-label={`Progress: ${REFERRAL_STAGE[stage].label}`}>
        {REFERRAL_STEPS.map((step, i) => (
          <span
            key={step.key}
            title={step.label}
            className={cx(
              "h-1.5 w-5 rounded-full",
              i <= reachedIndex ? (stopped ? "bg-rose-300" : "bg-foil") : "bg-rule",
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <ol className="flex flex-wrap items-start gap-y-4">
      {REFERRAL_STEPS.map((step, i) => {
        const done = i < reachedIndex || (i === reachedIndex && !stopped && step.key === "delivered");
        const current = i === reachedIndex;
        const failedHere = stopped && current;
        return (
          <li key={step.key} className="flex min-w-[5.5rem] flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cx("h-px flex-1", i === 0 ? "bg-transparent" : i <= reachedIndex ? "bg-foil" : "bg-rule")} />
              <span
                className={cx(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium",
                  failedHere
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : done
                      ? "border-foil bg-foil text-ink"
                      : current
                        ? "border-foil bg-ink text-foil-light"
                        : "border-rule bg-white text-graphite",
                )}
              >
                {failedHere ? <X className="size-3.5" /> : done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cx(
                  "h-px flex-1",
                  i === REFERRAL_STEPS.length - 1 ? "bg-transparent" : i < reachedIndex ? "bg-foil" : "bg-rule",
                )}
              />
            </div>
            <span className={cx("mt-1.5 text-xs", current ? "font-medium text-ink" : "text-graphite")}>
              {failedHere ? REFERRAL_STAGE[stage].label : step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
