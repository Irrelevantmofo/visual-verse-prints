import "server-only";
import { createClient } from "@/lib/supabase/server";
import { diffDays, monthEnd, monthStart, num, weekStart } from "@/lib/format";
import { followUpFlag, isOpenQuote, type FollowUpFlag } from "@/lib/labels";
import type {
  ReferralItem,
  CommissionEarning,
  CommissionPayout,
  LeaderboardRow,
  OrderSummary,
  Profile,
  QuotationSummary,
  ReferralSummary,
  Settings,
} from "@/types/db";

const DEFAULT_SETTINGS: Settings = { default_commission_rate: 0.05, quote_validity_days: 14, due_soon_days: 3 };

/** Numeric columns come back as strings from PostgREST; coerce the ones we do math on. */
function normOrder(o: OrderSummary): OrderSummary {
  return {
    ...o,
    total_amount: num(o.total_amount),
    commission_rate: num(o.commission_rate),
    commission_total: num(o.commission_total),
    paid_amount: num(o.paid_amount),
    balance: num(o.balance),
    commission_earned: num(o.commission_earned),
    commission_pending: num(o.commission_pending),
    total_qty: num(o.total_qty),
  };
}
function normQuote(q: QuotationSummary): QuotationSummary {
  return { ...q, quoted_amount: num(q.quoted_amount), days_to_expiry: num(q.days_to_expiry) };
}
function normReferral(r: ReferralSummary): ReferralSummary {
  return {
    ...r,
    estimated_budget: r.estimated_budget == null ? null : num(r.estimated_budget),
    total_ordered: num(r.total_ordered),
    total_paid: num(r.total_paid),
    commission_earned: num(r.commission_earned),
    open_quote_value: num(r.open_quote_value),
    order_count: num(r.order_count),
    quote_count: num(r.quote_count),
  };
}

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    default_commission_rate: num(data.default_commission_rate),
    quote_validity_days: num(data.quote_validity_days),
    due_soon_days: num(data.due_soon_days),
  };
}

export async function getAgents(opts: { activeOnly?: boolean } = {}): Promise<Profile[]> {
  const supabase = await createClient();
  let q = supabase.from("profiles").select("*").eq("role", "agent").order("full_name");
  if (opts.activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return ((data ?? []) as Profile[]).map((p) => ({
    ...p,
    commission_rate: p.commission_rate == null ? null : num(p.commission_rate),
  }));
}

export async function getOrders(filter: {
  from?: string;
  to?: string;
  agentId?: string;
  referralId?: string;
  status?: string;
  limit?: number;
} = {}): Promise<OrderSummary[]> {
  const supabase = await createClient();
  let q = supabase.from("order_summary").select("*").order("order_date", { ascending: false }).order("order_no", { ascending: false });
  if (filter.from) q = q.gte("order_date", filter.from);
  if (filter.to) q = q.lte("order_date", filter.to);
  if (filter.agentId) q = q.eq("agent_id", filter.agentId);
  if (filter.referralId) q = q.eq("referral_id", filter.referralId);
  if (filter.status) q = q.eq("order_status", filter.status);
  if (filter.limit) q = q.limit(filter.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as OrderSummary[]).map(normOrder);
}

export async function getOrder(id: string): Promise<OrderSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("order_summary").select("*").eq("id", id).maybeSingle();
  return data ? normOrder(data as OrderSummary) : null;
}

export async function getQuotations(filter: {
  from?: string;
  to?: string;
  agentId?: string;
  referralId?: string;
  status?: string;
  limit?: number;
} = {}): Promise<QuotationSummary[]> {
  const supabase = await createClient();
  let q = supabase.from("quotation_summary").select("*").order("date_sent", { ascending: false }).order("quote_no", { ascending: false });
  if (filter.from) q = q.gte("date_sent", filter.from);
  if (filter.to) q = q.lte("date_sent", filter.to);
  if (filter.agentId) q = q.eq("agent_id", filter.agentId);
  if (filter.referralId) q = q.eq("referral_id", filter.referralId);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.limit) q = q.limit(filter.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as QuotationSummary[]).map(normQuote);
}

export async function getReferrals(filter: { agentId?: string; status?: string; limit?: number } = {}): Promise<ReferralSummary[]> {
  const supabase = await createClient();
  let q = supabase.from("referral_summary").select("*").order("created_at", { ascending: false });
  if (filter.agentId) q = q.eq("agent_id", filter.agentId);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.limit) q = q.limit(filter.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as ReferralSummary[]).map(normReferral);
}

export async function getReferral(id: string): Promise<ReferralSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("referral_summary").select("*").eq("id", id).maybeSingle();
  return data ? normReferral(data as ReferralSummary) : null;
}

export async function getReferralItems(referralId: string): Promise<ReferralItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("referral_items").select("*").eq("referral_id", referralId).order("position");
  if (error) throw new Error(error.message);
  return ((data ?? []) as ReferralItem[]).map((i) => ({ ...i, qty: num(i.qty) }));
}

export async function countPendingReferrals(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("referrals").select("id", { count: "exact", head: true }).eq("status", "submitted");
  return count ?? 0;
}

export async function getLeaderboard(from: string, to: string): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("agent_leaderboard", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return ((data ?? []) as LeaderboardRow[]).map((r) => ({
    ...r,
    commission_earned: num(r.commission_earned),
    sales_booked: num(r.sales_booked),
    orders_count: num(r.orders_count),
    referrals_count: num(r.referrals_count),
    rank: num(r.rank),
  }));
}

export async function getCommissionEarnings(filter: { agentId?: string; from?: string; to?: string } = {}): Promise<CommissionEarning[]> {
  const supabase = await createClient();
  let q = supabase.from("commission_earnings").select("*").order("paid_on", { ascending: false });
  if (filter.agentId) q = q.eq("agent_id", filter.agentId);
  if (filter.from) q = q.gte("paid_on", filter.from);
  if (filter.to) q = q.lte("paid_on", filter.to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as CommissionEarning[]).map((e) => ({
    ...e,
    payment_amount: num(e.payment_amount),
    commission: num(e.commission),
    commission_rate: num(e.commission_rate),
  }));
}

export async function getPayouts(filter: { agentId?: string } = {}): Promise<(CommissionPayout & { agent_name?: string })[]> {
  const supabase = await createClient();
  let q = supabase.from("commission_payouts").select("*, agent:profiles(full_name)").order("paid_on", { ascending: false });
  if (filter.agentId) q = q.eq("agent_id", filter.agentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((p: CommissionPayout & { agent?: { full_name: string } | null }) => ({
    ...p,
    amount: num(p.amount),
    agent_name: p.agent?.full_name,
  }));
}

/* ───────────────────────── Aggregations (mirror the spreadsheet formulas) ───────────────────────── */

export type OrderTotals = { count: number; booked: number; collected: number; balance: number };

/** Cancelled orders are excluded from all totals. */
export function sumOrders(orders: OrderSummary[]): OrderTotals {
  return orders.filter((o) => o.order_status !== "cancelled").reduce(
    (t, o) => ({
      count: t.count + 1,
      booked: t.booked + o.total_amount,
      collected: t.collected + o.paid_amount,
      balance: t.balance + o.balance,
    }),
    { count: 0, booked: 0, collected: 0, balance: 0 },
  );
}

/** Quotes that are open and not yet expired as of `asOf` (sheet: "Open Quote Pipeline"). */
export function openPipeline(quotes: QuotationSummary[], asOf: string) {
  const open = quotes.filter((q) => isOpenQuote(q.status) && q.date_sent <= asOf && q.expires_on >= asOf);
  return { count: open.length, value: open.reduce((s, q) => s + q.quoted_amount, 0), quotes: open };
}

export function flagCounts(quotes: QuotationSummary[], asOf: string, dueSoonDays: number) {
  const counts: Record<FollowUpFlag, number> = { expired: 0, due_soon: 0, active: 0 };
  for (const q of quotes) {
    if (q.date_sent > asOf) continue;
    const flag = followUpFlag(q.status, q.expires_on, asOf, dueSoonDays, diffDays);
    if (flag) counts[flag] += 1;
  }
  return counts;
}

export type AgentPeriodRow = {
  agentId: string;
  name: string;
  totals: OrderTotals;
  openQuotes: number;
  pipeline: number;
};

export function byAgent(
  agents: Pick<Profile, "id" | "full_name">[],
  orders: OrderSummary[],
  quotes: QuotationSummary[],
  pipelineAsOf: string,
): AgentPeriodRow[] {
  return agents.map((a) => {
    const pipe = openPipeline(
      quotes.filter((q) => q.agent_id === a.id),
      pipelineAsOf,
    );
    return {
      agentId: a.id,
      name: a.full_name,
      totals: sumOrders(orders.filter((o) => o.agent_id === a.id)),
      openQuotes: pipe.count,
      pipeline: pipe.value,
    };
  });
}

export function periodBounds(asOf: string) {
  return {
    weekFrom: weekStart(asOf),
    monthFrom: monthStart(asOf),
    monthTo: monthEnd(asOf),
  };
}
