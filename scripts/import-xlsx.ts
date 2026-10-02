/**
 * One-time import of the Visual Verse pipeline workbook into Supabase.
 *
 *   npx tsx scripts/import-xlsx.ts "<path to .xlsx>" [--dry-run]
 *
 * - Reads the "Confirmed Orders" and "Quotations" sheets (header row 3, data from row 4).
 * - Maps the Agent column to agent profiles by full_name (case-insensitive) or first name,
 *   so add the agents in Admin → Agents first.
 * - Each order becomes: orders row + one order_items row + one payment for the Paid Amount
 *   (dated the order date). Commission rate is snapshotted from the agent at insert.
 * - Each imported agent client becomes an approved referral so it shows in the agent's pipeline.
 * - Re-running skips rows already imported (matched by notes tag "[import:<sheet>:<row>]").
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

config({ path: ".env.local" });

const ORDER_STATUS: Record<string, string> = {
  "in progress": "in_progress",
  "ready for delivery / pick-up": "ready",
  "shipped / delivered": "delivered",
  cancelled: "cancelled",
};
const DELIVERY_STATUS: Record<string, string> = {
  "in progress": "in_progress",
  "ready for delivery / pick-up": "ready",
  "shipped / delivered": "delivered",
};
const QUOTE_STATUS: Record<string, string> = {
  "quotation sent / pending follow-up": "pending",
  "follow-up scheduled": "follow_up_scheduled",
  "won / converted": "won",
  "lost / declined": "lost",
};

type Row = Record<string, unknown>;

function sheetRows(wb: XLSX.WorkBook, name: string): { row: number; data: Row }[] {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" not found`);
  // Header is on row 3 (index 2)
  const rows = XLSX.utils.sheet_to_json<Row>(ws, { range: 2, raw: true, defval: null });
  return rows.map((data, i) => ({ row: i + 4, data })).filter((r) => r.data[Object.keys(r.data)[0]] != null);
}

function toISO(v: unknown): string {
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Unrecognised date: ${s}`);
  return d.toISOString().slice(0, 10);
}

const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
const str = (v: unknown) => (v == null ? "" : String(v).trim());

async function main() {
  const file = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!file) {
    console.error('Usage: npx tsx scripts/import-xlsx.ts "<path to .xlsx>" [--dry-run]');
    process.exit(1);
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });

  const wb = XLSX.readFile(file, { cellDates: false });
  const orders = sheetRows(wb, "Confirmed Orders");
  const quotes = sheetRows(wb, "Quotations");

  const { data: profiles, error: pErr } = await supabase.from("profiles").select("id, full_name").eq("role", "agent");
  if (pErr) throw pErr;
  const findAgent = (name: string) => {
    const key = name.toLowerCase();
    return (profiles ?? []).find(
      (p) => p.full_name.toLowerCase() === key || p.full_name.toLowerCase().split(" ")[0] === key,
    );
  };

  const missing = new Set<string>();
  for (const r of [...orders, ...quotes]) {
    const a = str(r.data["Agent"]);
    if (a && !findAgent(a)) missing.add(a);
  }
  if (missing.size) {
    console.error(`No agent profile for: ${[...missing].join(", ")}. Add them in Admin → Agents first.`);
    process.exit(1);
  }

  const { data: existingOrders } = await supabase.from("orders").select("notes").like("notes", "%[import:%");
  const { data: existingQuotes } = await supabase.from("quotations").select("notes").like("notes", "%[import:%");
  const seen = new Set([...(existingOrders ?? []), ...(existingQuotes ?? [])].map((r) => (r.notes as string).match(/\[import:[^\]]+\]/)?.[0]));

  // One approved referral per agent+client so imported work shows in the agent pipeline.
  const referralIds = new Map<string, string>();
  async function referralFor(agentId: string, client: string, date: string) {
    const key = `${agentId}|${client.toLowerCase()}`;
    if (referralIds.has(key)) return referralIds.get(key)!;
    const { data: found } = await supabase
      .from("referrals")
      .select("id")
      .eq("agent_id", agentId)
      .ilike("client_name", client)
      .maybeSingle();
    if (found) {
      referralIds.set(key, found.id);
      return found.id as string;
    }
    if (dryRun) return "dry-run";
    const { data, error } = await supabase
      .from("referrals")
      .insert({
        agent_id: agentId,
        client_name: client,
        client_contact: "Imported from spreadsheet",
        status: "approved",
        review_notes: "Imported from the pipeline spreadsheet.",
        reviewed_at: new Date().toISOString(),
        created_at: `${date}T09:00:00+08:00`,
      })
      .select("id")
      .single();
    if (error) throw error;
    referralIds.set(key, data.id);
    return data.id as string;
  }

  let oCount = 0;
  for (const { row, data } of orders) {
    const tag = `[import:orders:${row}]`;
    if (seen.has(tag)) continue;
    const date = toISO(data["Order Date"]);
    const agent = findAgent(str(data["Agent"]))!;
    const client = str(data["Client"]);
    const total = n(data["Total Amount"]);
    const paid = n(data["Paid Amount"]);
    const orderStatus = ORDER_STATUS[str(data["Order Status"]).toLowerCase()] ?? "in_progress";
    const deliveryStatus = DELIVERY_STATUS[str(data["Delivery Status"]).toLowerCase()] ?? "in_progress";
    const notes = [str(data["Notes"]), tag].filter(Boolean).join(" ");

    console.log(`order  r${row}  ${date}  ${agent.full_name.padEnd(10)} ${client.padEnd(20)} ₱${total}  paid ₱${paid}`);
    if (dryRun) {
      oCount++;
      continue;
    }

    const referralId = await referralFor(agent.id, client, date);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        order_date: date,
        source: "referral",
        agent_id: agent.id,
        referral_id: referralId,
        client_name: client,
        order_status: orderStatus,
        delivery_status: deliveryStatus,
        notes,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { error: iErr } = await supabase.from("order_items").insert({
      order_id: order.id,
      description: str(data["Items"]) || "Order",
      qty: n(data["Qty"]) || 1,
      amount: total,
      position: 0,
    });
    if (iErr) throw iErr;
    if (paid > 0) {
      const { error: payErr } = await supabase
        .from("payments")
        .insert({ order_id: order.id, amount: Math.min(paid, total), paid_on: date, method: "other", notes: "Imported" });
      if (payErr) throw payErr;
    }
    oCount++;
  }

  let qCount = 0;
  for (const { row, data } of quotes) {
    const tag = `[import:quotes:${row}]`;
    if (seen.has(tag)) continue;
    const date = toISO(data["Date Sent"]);
    const agent = findAgent(str(data["Agent"]))!;
    const client = str(data["Client"]);
    const status = QUOTE_STATUS[str(data["Status"]).toLowerCase()] ?? "pending";
    console.log(`quote  r${row}  ${date}  ${agent.full_name.padEnd(10)} ${client.padEnd(20)} ₱${n(data["Quoted Amount"])}  ${status}`);
    if (dryRun) {
      qCount++;
      continue;
    }
    const referralId = await referralFor(agent.id, client, date);
    const { error } = await supabase.from("quotations").insert({
      date_sent: date,
      agent_id: agent.id,
      referral_id: referralId,
      client_name: client,
      quoted_amount: n(data["Quoted Amount"]),
      status,
      notes: [str(data["Notes"]), tag].filter(Boolean).join(" "),
    });
    if (error) throw error;
    qCount++;
  }

  console.log(`\n${dryRun ? "Would import" : "Imported"} ${oCount} orders and ${qCount} quotations.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
