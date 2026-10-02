"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { zodErrorState, type ActionState } from "@/lib/actions/types";

/* ── shared field helpers ── */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();
const optionalId = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid().nullable())
  .optional();
const isoDate = z.iso.date("Pick a date.");
const money = z.coerce.number({ error: "Enter an amount." }).min(0, "Amount can't be negative.").multipleOf(0.01, "Use at most 2 decimals.");

function formObject(formData: FormData) {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of formData.entries()) if (!k.startsWith("$ACTION")) obj[k] = v;
  return obj;
}

/** A referral always credits its own agent, whatever the form sent. */
async function agentForReferral(
  supabase: Awaited<ReturnType<typeof createClient>>,
  referralId: string | null | undefined,
  agentId: string | null | undefined,
) {
  if (!referralId) return agentId ?? null;
  const { data } = await supabase.from("referrals").select("agent_id").eq("id", referralId).single();
  return (data?.agent_id as string | undefined) ?? agentId ?? null;
}

function revalidateStaff() {
  revalidatePath("/admin", "layout");
  revalidatePath("/agent", "layout");
}

/* ───────────────────────── Referrals ───────────────────────── */

const reviewSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approved", "rejected"]),
  review_notes: optionalText,
});

export async function reviewReferral(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole("admin");
  const parsed = reviewSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { id, decision, review_notes } = parsed.data;
  if (decision === "rejected" && !review_notes) {
    return { error: "Add a note so the agent knows why the referral wasn't accepted.", fieldErrors: { review_notes: "Required when rejecting." } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("referrals")
    .update({ status: decision, review_notes, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateStaff();
  return { message: decision === "approved" ? "Referral approved." : "Referral rejected." };
}

const referralEditSchema = z.object({
  id: z.uuid(),
  client_name: z.string().trim().min(1, "Enter the client's name."),
  client_contact: z.string().trim().min(1, "Enter a phone number, email or Facebook link."),
  client_company: optionalText,
  interested_in: optionalText,
  notes: optionalText,
});

export async function updateReferral(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = referralEditSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { id, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("referrals").update(rest).eq("id", id);
  if (error) return { error: error.message };
  revalidateStaff();
  return { message: "Referral saved." };
}

/* ───────────────────────── Quotations ───────────────────────── */

const quoteSchema = z.object({
  id: optionalId,
  date_sent: isoDate,
  agent_id: optionalId,
  referral_id: optionalId,
  client_name: z.string().trim().min(1, "Enter the client's name."),
  client_contact: optionalText,
  description: optionalText,
  quoted_amount: money,
  expires_on: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.iso.date().nullable())
    .optional(),
  status: z.enum(["pending", "follow_up_scheduled", "won", "lost"]),
  follow_up_on: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.iso.date().nullable())
    .optional(),
  notes: optionalText,
});

export async function saveQuotation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = quoteSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { id, ...values } = parsed.data;
  const supabase = await createClient();
  values.agent_id = await agentForReferral(supabase, values.referral_id, values.agent_id);

  if (id) {
    const { error } = await supabase
      .from("quotations")
      .update({ ...values, expires_on: values.expires_on ?? undefined })
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("quotations").insert({ ...values, expires_on: values.expires_on ?? null });
    if (error) return { error: error.message };
  }
  revalidateStaff();
  redirect("/admin/quotations");
}

export async function deleteQuotation(formData: FormData) {
  await requireRole("admin");
  const id = z.uuid().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("quotations").delete().eq("id", id);
  revalidateStaff();
  redirect("/admin/quotations");
}

export async function setQuotationStatus(formData: FormData) {
  await requireRole("admin");
  const id = z.uuid().parse(formData.get("id"));
  const status = z.enum(["pending", "follow_up_scheduled", "won", "lost"]).parse(formData.get("status"));
  const supabase = await createClient();
  await supabase.from("quotations").update({ status }).eq("id", id);
  revalidateStaff();
}

/* ───────────────────────── Orders ───────────────────────── */

const itemSchema = z.object({
  description: z.string().trim().min(1, "Describe each item."),
  qty: z.coerce.number().positive("Quantity must be more than 0."),
  amount: money,
  product_id: z.uuid().nullable().optional(),
});

const orderSchema = z.object({
  id: optionalId,
  order_date: isoDate,
  source: z.enum(["referral", "direct", "website"]),
  agent_id: optionalId,
  referral_id: optionalId,
  quotation_id: optionalId,
  client_name: z.string().trim().min(1, "Enter the client's name."),
  client_contact: optionalText,
  order_status: z.enum(["in_progress", "ready", "delivered", "cancelled"]),
  delivery_status: z.enum(["in_progress", "ready", "delivered"]),
  notes: optionalText,
  items: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s);
      } catch {
        ctx.addIssue({ code: "custom", message: "Items are invalid." });
        return z.NEVER;
      }
    })
    .pipe(z.array(itemSchema).min(1, "Add at least one item.")),
  initial_payment: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 0))
    .pipe(z.number().min(0, "Payment can't be negative.")),
  payment_method: z.enum(["cash", "gcash", "maya", "bank_transfer", "card", "other"]).optional(),
});

export async function saveOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = orderSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { id, items, initial_payment, payment_method, ...values } = parsed.data;
  const total = items.reduce((s, i) => s + i.amount, 0);
  if (initial_payment > total + 0.001) return { error: "The payment is more than the order total." };

  const supabase = await createClient();
  values.agent_id = await agentForReferral(supabase, values.referral_id, values.agent_id);
  let orderId = id ?? null;

  if (orderId) {
    const { error } = await supabase.from("orders").update(values).eq("id", orderId);
    if (error) return { error: error.message };
    const { error: delErr } = await supabase.from("order_items").delete().eq("order_id", orderId);
    if (delErr) return { error: delErr.message };
  } else {
    const { data, error } = await supabase.from("orders").insert(values).select("id").single();
    if (error) return { error: error.message };
    orderId = data.id as string;
  }

  const { error: itemErr } = await supabase
    .from("order_items")
    .insert(items.map((it, position) => ({ ...it, order_id: orderId, position })));
  if (itemErr) return { error: itemErr.message };

  if (!id && initial_payment > 0) {
    const { error: payErr } = await supabase.from("payments").insert({
      order_id: orderId,
      amount: initial_payment,
      method: payment_method ?? "cash",
      paid_on: values.order_date,
    });
    if (payErr) return { error: payErr.message };
  }

  if (values.quotation_id && !id) {
    await supabase.from("quotations").update({ status: "won" }).eq("id", values.quotation_id);
  }

  revalidateStaff();
  redirect(`/admin/orders/${orderId}`);
}

export async function deleteOrder(formData: FormData) {
  await requireRole("admin");
  const id = z.uuid().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("orders").delete().eq("id", id);
  revalidateStaff();
  redirect("/admin/orders");
}

const statusSchema = z.object({
  id: z.uuid(),
  order_status: z.enum(["in_progress", "ready", "delivered", "cancelled"]),
  delivery_status: z.enum(["in_progress", "ready", "delivered"]),
});

export async function updateOrderStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = statusSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { id, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update(rest).eq("id", id);
  if (error) return { error: error.message };
  revalidateStaff();
  return { message: "Status updated." };
}

const paymentSchema = z.object({
  order_id: z.uuid(),
  amount: money.refine((v) => v > 0, "Enter an amount above 0."),
  paid_on: isoDate,
  method: z.enum(["cash", "gcash", "maya", "bank_transfer", "card", "other"]),
  reference: optionalText,
  notes: optionalText,
});

export async function addPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = paymentSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { data: order } = await supabase.from("order_summary").select("balance").eq("id", parsed.data.order_id).single();
  if (order && parsed.data.amount > Number(order.balance) + 0.001) {
    return { error: "That's more than the remaining balance." };
  }
  const { error } = await supabase.from("payments").insert(parsed.data);
  if (error) return { error: error.message };
  revalidateStaff();
  return { message: "Payment recorded." };
}

export async function deletePayment(formData: FormData) {
  await requireRole("admin");
  const id = z.uuid().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("payments").delete().eq("id", id);
  revalidateStaff();
}

/* ───────────────────────── Agents ───────────────────────── */

const rateField = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : Number(v) / 100))
  .pipe(z.number().min(0, "Rate can't be negative.").max(1, "Rate can't exceed 100%.").nullable());

const newAgentSchema = z.object({
  full_name: z.string().trim().min(1, "Enter the agent's name."),
  email: z.email("Enter a valid email address."),
  phone: optionalText,
  password: z.string().min(8, "Temporary password needs at least 8 characters."),
  commission_rate: rateField,
});

export async function createAgent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = newAgentSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { email, password, full_name, phone, commission_rate } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) return { error: error.message };

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ full_name, phone, commission_rate, role: "agent", active: true })
    .eq("id", data.user.id);
  if (profileErr) return { error: profileErr.message };

  revalidateStaff();
  return { message: `${full_name} can now sign in with ${email} and the temporary password.` };
}

const updateAgentSchema = z.object({
  id: z.uuid(),
  full_name: z.string().trim().min(1, "Enter the agent's name."),
  phone: optionalText,
  commission_rate: rateField,
  active: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export async function updateAgent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = updateAgentSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { id, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(rest).eq("id", id).eq("role", "agent");
  if (error) return { error: error.message };
  revalidateStaff();
  return { message: "Agent saved." };
}

const resetSchema = z.object({ id: z.uuid(), password: z.string().min(8, "Use at least 8 characters.") });

export async function resetAgentPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = resetSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("role").eq("id", parsed.data.id).single();
  if (target?.role !== "agent") return { error: "Only agent passwords can be reset here." };
  const { error } = await createAdminClient().auth.admin.updateUserById(parsed.data.id, { password: parsed.data.password });
  if (error) return { error: error.message };
  return { message: "Temporary password set. Share it with the agent privately." };
}

/* ───────────────────────── Commission payouts ───────────────────────── */

const payoutSchema = z.object({
  agent_id: z.uuid("Pick an agent."),
  amount: money.refine((v) => v > 0, "Enter an amount above 0."),
  paid_on: isoDate,
  period_label: optionalText,
  notes: optionalText,
});

export async function recordPayout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = payoutSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("commission_payouts").insert(parsed.data);
  if (error) return { error: error.message };
  revalidateStaff();
  return { message: "Payout recorded." };
}

export async function deletePayout(formData: FormData) {
  await requireRole("admin");
  const id = z.uuid().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("commission_payouts").delete().eq("id", id);
  revalidateStaff();
}

/* ───────────────────────── Catalog ───────────────────────── */

const productSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1, "Enter a name."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes."),
  category: z.string().trim().min(1, "Enter a category."),
  description: optionalText,
  starting_price: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : Number(v)))
    .pipe(z.number().min(0).nullable()),
  unit: optionalText,
  image_url: optionalText,
  sort_order: z.coerce.number().int().default(0),
  active: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = productSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { id, ...values } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("products").update(values).eq("id", id)
    : await supabase.from("products").insert(values);
  if (error) return { error: error.code === "23505" ? "That slug is already used." : error.message };
  revalidatePath("/");
  revalidatePath("/admin/catalog");
  return { message: id ? "Product saved." : "Product added." };
}

export async function deleteProduct(formData: FormData) {
  await requireRole("admin");
  const id = z.uuid().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/");
  revalidatePath("/admin/catalog");
}

/* ───────────────────────── Settings ───────────────────────── */

const settingsSchema = z.object({
  default_commission_rate: z.coerce
    .number()
    .min(0, "Rate can't be negative.")
    .max(100, "Rate can't exceed 100%.")
    .transform((v) => v / 100),
  quote_validity_days: z.coerce.number().int().min(1, "At least 1 day."),
  due_soon_days: z.coerce.number().int().min(0),
});

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = settingsSchema.safeParse(formObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update(parsed.data).eq("id", true);
  if (error) return { error: error.message };
  revalidateStaff();
  return { message: "Settings saved." };
}
