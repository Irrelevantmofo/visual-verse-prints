// Row shapes for the Supabase schema (supabase/migrations). Regenerate full types with
// the Supabase MCP `generate_typescript_types` once connected; these cover what the app reads.

export type UserRole = "admin" | "agent";
export type ReferralStatus = "submitted" | "approved" | "rejected";
export type QuoteStatus = "pending" | "follow_up_scheduled" | "won" | "lost";
/** pending_review and awaiting_payment are the pre-production stages of a website order. */
export type OrderStatus = "pending_review" | "awaiting_payment" | "in_progress" | "ready" | "delivered" | "cancelled";
export type ProofStatus = "pending" | "approved" | "rejected";
export type DeliveryStatus = "in_progress" | "ready" | "delivered";
export type OrderSource = "referral" | "direct" | "website";
export type PaymentMethod = "cash" | "gcash" | "maya" | "bank_transfer" | "card" | "other";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type ReferralStage =
  | "submitted"
  | "approved"
  | "quoted"
  | "in_production"
  | "ready"
  | "delivered"
  | "lost"
  | "rejected";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  commission_rate: number | null;
  active: boolean;
  created_at: string;
};

export type Settings = {
  default_commission_rate: number;
  quote_validity_days: number;
  due_soon_days: number;
  /** Customers can place orders on the website (off until the shop is ready). */
  online_ordering_enabled: boolean;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  starting_price: number | null;
  unit: string | null;
  /** Agent commission for this product; null = use the agent's/shop default. */
  commission_rate: number | null;
  /** Cover photo (first of image_urls); kept in sync on save. */
  image_url: string | null;
  /** Showcase photos of finished work, in display order. */
  image_urls: string[];
  active: boolean;
  sort_order: number;
};

export type Referral = {
  id: string;
  ref_no: number;
  agent_id: string;
  client_name: string;
  client_contact: string;
  client_company: string | null;
  interested_in: string | null;
  estimated_budget: number | null;
  notes: string | null;
  status: ReferralStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ReferralItem = {
  id: string;
  referral_id: string;
  product_id: string | null;
  description: string;
  qty: number;
  details: string | null;
  position: number;
};

export type ReferralSummary = Referral & {
  agent_name: string | null;
  order_count: number;
  total_ordered: number;
  total_paid: number;
  commission_earned: number;
  quote_count: number;
  open_quote_value: number;
  stage: ReferralStage;
};

export type Quotation = {
  id: string;
  quote_no: number;
  date_sent: string;
  agent_id: string | null;
  referral_id: string | null;
  client_name: string;
  client_contact: string | null;
  description: string | null;
  quoted_amount: number;
  expires_on: string;
  status: QuoteStatus;
  follow_up_on: string | null;
  notes: string | null;
};

export type QuotationSummary = Quotation & {
  agent_name: string | null;
  days_to_expiry: number;
};

export type Order = {
  id: string;
  order_no: number;
  order_date: string;
  source: OrderSource;
  agent_id: string | null;
  referral_id: string | null;
  quotation_id: string | null;
  client_name: string;
  client_contact: string | null;
  total_amount: number;
  /** Σ(line amount × line rate); 0 when the order has no agent. */
  commission_total: number;
  order_status: OrderStatus;
  delivery_status: DeliveryStatus;
  notes: string | null;
  /** Unguessable code in the customer's order link (website orders only). */
  public_token: string | null;
  /** What the customer wrote when ordering on the website. */
  customer_notes: string | null;
};

export type PaymentChannel = {
  id: string;
  name: string;
  method: PaymentMethod;
  account_name: string | null;
  account_number: string | null;
  qr_url: string | null;
  instructions: string | null;
  active: boolean;
  sort_order: number;
};

export type PaymentProof = {
  id: string;
  order_id: string;
  channel_id: string | null;
  storage_path: string;
  claimed_amount: number | null;
  reference: string | null;
  status: ProofStatus;
  review_note: string | null;
  reviewed_at: string | null;
  payment_id: string | null;
  created_at: string;
};

export type OrderSummary = Order & {
  agent_name: string | null;
  items: string;
  total_qty: number;
  paid_amount: number;
  balance: number;
  payment_status: PaymentStatus;
  /** Effective rate across all lines (commission_total / total_amount). */
  commission_rate: number;
  commission_earned: number;
  commission_pending: number;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  description: string;
  qty: number;
  amount: number;
  commission_rate: number;
  position: number;
};

export type Payment = {
  id: string;
  order_id: string;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
};

export type CommissionEarning = {
  payment_id: string;
  paid_on: string;
  payment_amount: number;
  order_id: string;
  order_no: number;
  client_name: string;
  agent_id: string;
  commission_rate: number;
  commission: number;
};

export type CommissionPayout = {
  id: string;
  agent_id: string;
  amount: number;
  paid_on: string;
  period_label: string | null;
  notes: string | null;
};

export type LeaderboardRow = {
  agent_id: string;
  agent_name: string;
  commission_earned: number;
  sales_booked: number;
  orders_count: number;
  referrals_count: number;
  rank: number;
};
