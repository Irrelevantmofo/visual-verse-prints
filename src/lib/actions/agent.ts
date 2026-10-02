"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { itemsSummary } from "@/lib/format";
import { zodErrorState, type ActionState } from "@/lib/actions/types";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const itemSchema = z.object({
  product_id: z.uuid().nullable(),
  description: z.string().trim().min(1, "Name each product.").max(120),
  qty: z.coerce.number({ error: "Enter a quantity." }).positive("Quantity must be more than 0."),
  details: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

const referralSchema = z.object({
  client_name: z.string().trim().min(1, "Enter the client's name.").max(120),
  client_contact: z.string().trim().min(3, "Enter a phone number, email or Facebook link.").max(200),
  client_company: optionalText,
  estimated_budget: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : Number(v)))
    .pipe(z.number({ error: "Enter a number." }).min(0, "Budget can't be negative.").nullable()),
  notes: optionalText,
  items: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s);
      } catch {
        ctx.addIssue({ code: "custom", message: "The product list is invalid." });
        return z.NEVER;
      }
    })
    .pipe(z.array(itemSchema).min(1, "Add at least one product the client wants.").max(30)),
});

export async function submitReferral(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const agent = await requireRole("agent");
  const parsed = referralSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { items, ...referral } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("referrals")
    // interested_in keeps a one-line summary for lists and search
    .insert({ ...referral, interested_in: itemsSummary(items), agent_id: agent.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: itemsError } = await supabase
    .from("referral_items")
    .insert(items.map((it, position) => ({ ...it, referral_id: data.id, position })));
  if (itemsError) {
    return { error: `Your referral was sent, but the product list didn't save (${itemsError.message}). Add the products in the notes or tell the shop.` };
  }

  revalidatePath("/agent", "layout");
  revalidatePath("/admin", "layout");
  redirect(`/agent/referrals/${data.id}?submitted=1`);
}
