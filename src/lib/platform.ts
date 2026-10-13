import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";

/**
 * Developer platform fee: 1% of every payment on an order placed through the website. The ledger is written by
 * database triggers and is append-only; only developer accounts can read it (enforced by RLS).
 */

export type PlatformFee = {
  id: string;
  kind: "payment" | "adjustment" | "reversal";
  payment_id: string;
  order_id: string;
  order_no: number | null;
  client_name: string | null;
  paid_on: string;
  payment_amount: number;
  fee_rate: number;
  fee: number;
  note: string | null;
  created_at: string;
};

/** The developer list isn't readable through the API, so this check runs with the service role. */
export const isDeveloper = cache(async (userId: string): Promise<boolean> => {
  if (!process.env.SUPABASE_SECRET_KEY) return false;
  const { data } = await createAdminClient().from("platform_developers").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
});

/** Ledger entries, newest first. Returns nothing for non-developers (RLS). */
export async function getPlatformFees(): Promise<PlatformFee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_fees")
    .select("*")
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as PlatformFee[]).map((f) => ({
    ...f,
    payment_amount: num(f.payment_amount),
    fee_rate: num(f.fee_rate),
    fee: num(f.fee),
  }));
}

export type FeeMonth = { month: string; payments: number; collected: number; fee: number; reversed: number };

/** Totals per calendar month (by payment date), newest first. */
export function feesByMonth(fees: PlatformFee[]): FeeMonth[] {
  const months = new Map<string, FeeMonth>();
  for (const f of fees) {
    const key = f.paid_on.slice(0, 7);
    const m = months.get(key) ?? { month: key, payments: 0, collected: 0, fee: 0, reversed: 0 };
    if (f.kind === "payment") m.payments += 1;
    if (f.kind === "reversal") m.reversed += -f.fee;
    m.collected += f.payment_amount;
    m.fee += f.fee;
    months.set(key, m);
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}
