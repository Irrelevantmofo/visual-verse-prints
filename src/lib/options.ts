import "server-only";
import { getAgents, getReferrals, getSettings } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";

/** Select options shared by the quotation and order forms. */
export async function getFormOptions(includeReferralId?: string | null) {
  const [agents, referrals] = await Promise.all([getAgents(), getReferrals({ status: "approved" })]);
  const agentOptions = agents
    .filter((a) => a.active)
    .map((a) => ({ id: a.id, label: a.full_name || a.email || "Unnamed" }));
  // Keep a referral that's already linked selectable even if it's no longer approved.
  let refs = referrals;
  if (includeReferralId && !refs.some((r) => r.id === includeReferralId)) {
    const all = await getReferrals();
    const extra = all.find((r) => r.id === includeReferralId);
    if (extra) refs = [extra, ...refs];
  }
  const referralOptions = refs.map((r) => ({
    id: r.id,
    label: `R-${r.ref_no} · ${r.client_name} (${r.agent_name ?? "agent"})`,
    agentId: r.agent_id,
    clientName: r.client_name,
    clientContact: r.client_contact,
  }));
  return { agentOptions, referralOptions, referrals: refs };
}

/** Products (with their commission rates) plus agent/shop default rates, for the order form. */
export async function getOrderFormCommission() {
  const supabase = await createClient();
  const [agents, settings, { data: products }] = await Promise.all([
    getAgents(),
    getSettings(),
    supabase.from("products").select("id, name, commission_rate").order("sort_order"),
  ]);
  return {
    products: (products ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      commission_rate: p.commission_rate == null ? null : num(p.commission_rate),
    })),
    commission: {
      defaultRate: settings.default_commission_rate,
      agentRates: Object.fromEntries(agents.map((a) => [a.id, a.commission_rate])),
    },
  };
}
