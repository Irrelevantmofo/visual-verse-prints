"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { zodErrorState, type ActionState } from "@/lib/actions/types";

/** Admin actions for website orders: confirm prices, verify customer receipts, manage payment channels. */

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();
const isoDate = z.iso.date("Pick a date.");
const money = z.coerce.number({ error: "Enter an amount." }).positive("Enter an amount above 0.").multipleOf(0.01, "Use at most 2 decimals.");

function fields(formData: FormData) {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of formData.entries()) if (!k.startsWith("$ACTION")) obj[k] = v;
  return obj;
}

function revalidateOrders() {
  revalidatePath("/admin", "layout");
  revalidatePath("/agent", "layout");
}

/* ───────────────────────── Pricing ───────────────────────── */

/** The shop has priced a website order: let the customer pay. */
export async function confirmOrderPrice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Order not found." };

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("order_status, total_amount").eq("id", id.data).maybeSingle();
  if (!order) return { error: "Order not found." };
  if (order.order_status !== "pending_review") return { error: "This order's price is already confirmed." };
  if (Number(order.total_amount) <= 0) return { error: "Set the item prices first (Edit order), then confirm." };

  const { error } = await supabase.from("orders").update({ order_status: "awaiting_payment" }).eq("id", id.data);
  if (error) return { error: error.message };
  revalidateOrders();
  return { message: "Price confirmed. The customer can now pay from their order link." };
}

/* ───────────────────────── Receipts ───────────────────────── */

const approveSchema = z.object({
  proof_id: z.uuid(),
  amount: money,
  paid_on: isoDate,
  reference: optionalText,
});

export async function approveProof(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole("admin");
  const parsed = approveSchema.safeParse(fields(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { proof_id, amount, paid_on, reference } = parsed.data;

  const supabase = await createClient();
  const { data: proof } = await supabase
    .from("payment_proofs")
    .select("id, order_id, status, channel:payment_channels(method)")
    .eq("id", proof_id)
    .maybeSingle();
  if (!proof) return { error: "Receipt not found." };
  if (proof.status !== "pending") return { error: "This receipt was already reviewed." };

  const { data: order } = await supabase.from("order_summary").select("balance, order_status").eq("id", proof.order_id).single();
  if (!order) return { error: "Order not found." };
  if (order.order_status === "pending_review") return { error: "Confirm the order's price before verifying payments." };
  if (amount > Number(order.balance) + 0.001) {
    return { error: `That's more than the remaining balance (₱${Number(order.balance).toFixed(2)}). Adjust the amount.` };
  }

  const channel = proof.channel as { method: string } | { method: string }[] | null;
  const method = (Array.isArray(channel) ? channel[0]?.method : channel?.method) ?? "other";

  const { data: payment, error: payError } = await supabase
    .from("payments")
    .insert({ order_id: proof.order_id, amount, paid_on, method, reference, notes: "Verified from the customer's uploaded receipt" })
    .select("id")
    .single();
  if (payError) return { error: payError.message };

  const { error: proofError } = await supabase
    .from("payment_proofs")
    .update({ status: "approved", payment_id: payment.id, reviewed_by: admin.id, reviewed_at: new Date().toISOString(), review_note: null })
    .eq("id", proof_id);
  if (proofError) return { error: proofError.message };

  // Website orders need full payment: production starts once the balance is cleared
  const remaining = Number(order.balance) - amount;
  if (remaining <= 0.001) {
    await supabase.from("orders").update({ order_status: "in_progress" }).eq("id", proof.order_id).eq("order_status", "awaiting_payment");
  }

  revalidateOrders();
  return {
    message:
      remaining <= 0.001
        ? "Payment verified. The order is fully paid and now in production."
        : `Payment verified. ₱${remaining.toFixed(2)} is still due before production starts.`,
  };
}

const rejectSchema = z.object({
  proof_id: z.uuid(),
  review_note: z.string().trim().min(3, "Tell the customer what's wrong so they can fix it.").max(300),
});

export async function rejectProof(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole("admin");
  const parsed = rejectSchema.safeParse(fields(formData));
  if (!parsed.success) return zodErrorState(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_proofs")
    .update({ status: "rejected", review_note: parsed.data.review_note, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.proof_id)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "This receipt was already reviewed." };
  revalidateOrders();
  return { message: "Receipt rejected. The customer sees your note on their order page." };
}

/* ───────────────────────── Payment channels ───────────────────────── */

const QR_PREFIX = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/payment-qr/`;

const channelSchema = z.object({
  id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable())
    .optional(),
  name: z.string().trim().min(1, "Name this channel, e.g. GCash.").max(60),
  method: z.enum(["cash", "gcash", "maya", "bank_transfer", "card", "other"]),
  account_name: optionalText,
  account_number: optionalText,
  instructions: optionalText,
  qr_url: optionalText.refine((v) => v == null || v.startsWith(QR_PREFIX()), "Upload the QR image instead of pasting a link."),
  sort_order: z.coerce.number().int().default(0),
  active: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

function qrPath(url: string | null | undefined) {
  return url && url.startsWith(QR_PREFIX()) ? decodeURIComponent(url.slice(QR_PREFIX().length).split("?")[0]) : null;
}

export async function saveChannel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = channelSchema.safeParse(fields(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { id, ...values } = parsed.data;
  const supabase = await createClient();

  let previousQr: string | null = null;
  if (id) {
    const { data: existing } = await supabase.from("payment_channels").select("qr_url").eq("id", id).maybeSingle();
    previousQr = (existing?.qr_url as string | null) ?? null;
  }

  const { error } = id
    ? await supabase.from("payment_channels").update(values).eq("id", id)
    : await supabase.from("payment_channels").insert(values);
  if (error) return { error: error.message };

  const stale = qrPath(previousQr);
  if (stale && previousQr !== (values.qr_url ?? null)) await supabase.storage.from("payment-qr").remove([stale]);

  revalidatePath("/admin/settings");
  return { message: id ? "Payment channel saved." : "Payment channel added." };
}

export async function deleteChannel(formData: FormData) {
  await requireRole("admin");
  const id = z.uuid().parse(formData.get("id"));
  const supabase = await createClient();
  const { data: existing } = await supabase.from("payment_channels").select("qr_url").eq("id", id).maybeSingle();
  const { error } = await supabase.from("payment_channels").delete().eq("id", id);
  const stale = qrPath(existing?.qr_url as string | null);
  if (!error && stale) await supabase.storage.from("payment-qr").remove([stale]);
  revalidatePath("/admin/settings");
}
