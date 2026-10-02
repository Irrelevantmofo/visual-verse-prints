import type {
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  QuoteStatus,
  ReferralStage,
  ReferralStatus,
} from "@/types/db";

export type Tone = "neutral" | "gold" | "green" | "blue" | "amber" | "red";

type Meta = { label: string; tone: Tone };

export const ORDER_STATUS: Record<OrderStatus, Meta> = {
  in_progress: { label: "In Progress", tone: "blue" },
  ready: { label: "Ready for Delivery / Pick-up", tone: "amber" },
  delivered: { label: "Shipped / Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export const DELIVERY_STATUS: Record<DeliveryStatus, Meta> = {
  in_progress: { label: "In Progress", tone: "blue" },
  ready: { label: "Ready for Delivery / Pick-up", tone: "amber" },
  delivered: { label: "Shipped / Delivered", tone: "green" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, Meta> = {
  paid: { label: "Paid in Full", tone: "green" },
  partial: { label: "Partially Paid", tone: "amber" },
  unpaid: { label: "Unpaid", tone: "red" },
};

export const QUOTE_STATUS: Record<QuoteStatus, Meta> = {
  pending: { label: "Sent / Pending Follow-Up", tone: "gold" },
  follow_up_scheduled: { label: "Follow-Up Scheduled", tone: "blue" },
  won: { label: "Won / Converted", tone: "green" },
  lost: { label: "Lost / Declined", tone: "red" },
};

export const REFERRAL_STATUS: Record<ReferralStatus, Meta> = {
  submitted: { label: "Awaiting review", tone: "gold" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
};

/** Ordered progress steps an agent sees for each referral. */
export const REFERRAL_STEPS: { key: ReferralStage; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "quoted", label: "Quoted" },
  { key: "in_production", label: "In production" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
];

export const REFERRAL_STAGE: Record<ReferralStage, Meta> = {
  submitted: { label: "Under review", tone: "gold" },
  approved: { label: "Approved", tone: "neutral" },
  quoted: { label: "Quoted", tone: "blue" },
  in_production: { label: "In production", tone: "blue" },
  ready: { label: "Ready for pick-up", tone: "amber" },
  delivered: { label: "Delivered", tone: "green" },
  lost: { label: "Did not proceed", tone: "red" },
  rejected: { label: "Not accepted", tone: "red" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other",
};

export type FollowUpFlag = "expired" | "due_soon" | "active";

export const FOLLOW_UP_FLAG: Record<FollowUpFlag, Meta> = {
  expired: { label: "Expired", tone: "red" },
  due_soon: { label: "Due Soon", tone: "amber" },
  active: { label: "Active", tone: "green" },
};

export function isOpenQuote(status: QuoteStatus) {
  return status === "pending" || status === "follow_up_scheduled";
}

/** Same rule as the spreadsheet: Expired if past expiry, Due Soon within N days, else Active. */
export function followUpFlag(
  status: QuoteStatus,
  expiresOn: string,
  asOf: string,
  dueSoonDays: number,
  diffDays: (a: string, b: string) => number,
): FollowUpFlag | null {
  if (!isOpenQuote(status)) return null;
  const days = diffDays(expiresOn, asOf);
  if (days < 0) return "expired";
  if (days <= dueSoonDays) return "due_soon";
  return "active";
}
