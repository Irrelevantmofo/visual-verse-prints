"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { zodErrorState, type ActionState } from "@/lib/actions/types";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const referralSchema = z.object({
  client_name: z.string().trim().min(1, "Enter the client's name.").max(120),
  client_contact: z.string().trim().min(3, "Enter a phone number, email or Facebook link.").max(200),
  client_company: optionalText,
  interested_in: optionalText,
  estimated_budget: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : Number(v)))
    .pipe(z.number({ error: "Enter a number." }).min(0, "Budget can't be negative.").nullable()),
  notes: optionalText,
});

export async function submitReferral(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const agent = await requireRole("agent");
  const parsed = referralSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodErrorState(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("referrals")
    .insert({ ...parsed.data, agent_id: agent.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/agent", "layout");
  revalidatePath("/admin", "layout");
  redirect(`/agent/referrals/${data.id}?submitted=1`);
}
