"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { callerIpHash, isOrderingEnabled, isOrderToken, newOrderToken, ORDER_LIMITS, PROOFS_BUCKET } from "@/lib/ordering";
import { zodErrorState, type ActionState } from "@/lib/actions/types";

/**
 * Public actions for website ordering. Anyone can call these, so each one validates its input, checks the order
 * link where there is one, and enforces limits. They use the service-role client because customers have no login.
 */

const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const lineSchema = z.object({
  product_id: z.uuid().nullable(),
  description: z.string().trim().min(1, "Name each product.").max(120),
  qty: z.coerce.number({ error: "Enter a quantity." }).positive("Quantity must be more than 0.").max(1_000_000),
  details: trimmedOptional(300),
});

const orderSchema = z.object({
  client_name: z.string().trim().min(2, "Enter your name.").max(100),
  client_contact: z.string().trim().min(7, "Enter a mobile number or email we can reach you on.").max(120),
  customer_notes: trimmedOptional(1000),
  // Honeypot: real people never see or fill this field
  website: z.string().max(0).optional(),
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
    .pipe(z.array(lineSchema).min(1, "Add at least one product.").max(ORDER_LIMITS.itemsPerOrder)),
});

export async function createWebOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isOrderingEnabled())) return { error: "Online ordering isn't open yet. Message us and we'll take your order." };

  const parsed = orderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { items, website, ...customer } = parsed.data;
  void website;

  const admin = createAdminClient();
  const ipHash = await callerIpHash();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [{ count: mine }, { count: everyone }] = await Promise.all([
    admin.from("orders").select("id", { count: "exact", head: true }).eq("created_ip_hash", ipHash).gte("created_at", hourAgo),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("source", "website").gte("created_at", hourAgo),
  ]);
  if ((mine ?? 0) >= ORDER_LIMITS.ordersPerIpPerHour || (everyone ?? 0) >= ORDER_LIMITS.ordersPerHourSitewide) {
    return { error: "We've received a lot of orders in the last hour. Try again later, or message us directly." };
  }

  // Catalog lines use the catalog's own name, whatever the browser sent
  const productIds = [...new Set(items.map((i) => i.product_id).filter((id): id is string => id !== null))];
  const names = new Map<string, string>();
  if (productIds.length) {
    const { data: products } = await admin.from("products").select("id, name").in("id", productIds).eq("active", true);
    for (const p of products ?? []) names.set(p.id as string, p.name as string);
    if (names.size !== productIds.length) return { error: "One of the products is no longer available. Refresh the page and try again." };
  }

  const token = newOrderToken();
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      source: "website",
      order_status: "pending_review",
      client_name: customer.client_name,
      client_contact: customer.client_contact,
      customer_notes: customer.customer_notes ?? null,
      public_token: token,
      created_ip_hash: ipHash,
    })
    .select("id")
    .single();
  if (error) return { error: "We couldn't save your order. Try again in a moment." };

  const { error: itemsError } = await admin.from("order_items").insert(
    items.map((it, position) => {
      const name = it.product_id ? names.get(it.product_id)! : it.description;
      return {
        order_id: order.id,
        product_id: it.product_id,
        description: it.details ? `${name} (${it.details})` : name,
        qty: it.qty,
        amount: 0, // the shop sets prices when it reviews the order
        position,
      };
    }),
  );
  if (itemsError) {
    await admin.from("orders").delete().eq("id", order.id);
    return { error: "We couldn't save your order. Try again in a moment." };
  }

  revalidatePath("/admin", "layout");
  redirect(`/order/${token}?placed=1`);
}

/** Order lookup shared by the proof actions: the link must match, and the order must be payable. */
async function payableOrder(token: unknown) {
  if (!isOrderToken(token)) return { error: "This order link isn't valid." } as const;
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, order_status").eq("public_token", token).maybeSingle();
  if (!order) return { error: "This order link isn't valid." } as const;
  if (order.order_status === "pending_review") return { error: "We're still confirming your price. You can pay once it's confirmed." } as const;
  if (order.order_status === "cancelled") return { error: "This order was cancelled." } as const;

  const { data: proofs } = await admin.from("payment_proofs").select("status").eq("order_id", order.id);
  const all = proofs ?? [];
  if (all.length >= ORDER_LIMITS.proofsPerOrder) return { error: "This order has reached its upload limit. Message us for help." } as const;
  if (all.filter((p) => p.status === "pending").length >= ORDER_LIMITS.pendingProofsPerOrder) {
    return { error: "We're still checking the receipts you already sent. You can add more once those are reviewed." } as const;
  }
  return { admin, orderId: order.id as string } as const;
}

const PROOF_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/;

/** Step 1 of an upload: a one-time link that lets the browser put one image in the private bucket. */
export async function requestProofUpload(token: string, ext: string): Promise<{ error: string } | { path: string; uploadToken: string }> {
  if (!["webp", "jpg", "png"].includes(ext)) return { error: "Use a JPG, PNG or WebP image." };
  const found = await payableOrder(token);
  if ("error" in found) return { error: found.error as string };

  const path = `${found.orderId}/${randomUUID()}.${ext}`;
  const { data, error } = await found.admin.storage.from(PROOFS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "We couldn't start the upload. Try again." };
  return { path, uploadToken: data.token };
}

const proofSchema = z.object({
  token: z.string(),
  path: z.string().regex(PROOF_PATH),
  claimed_amount: z.coerce.number({ error: "Enter the amount you paid." }).positive("Enter the amount you paid.").max(10_000_000),
  reference: trimmedOptional(80),
  channel_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable())
    .optional(),
});

/** Step 2: record the uploaded receipt for the shop to verify. */
export async function submitPaymentProof(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = proofSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { token, path, claimed_amount, reference, channel_id } = parsed.data;

  const found = await payableOrder(token);
  if ("error" in found) return { error: found.error as string };
  const { admin, orderId } = found;

  // The file must be in this order's folder and must actually exist
  const [folder, file] = path.split("/");
  if (folder !== orderId) return { error: "That upload doesn't belong to this order." };
  const { data: listed } = await admin.storage.from(PROOFS_BUCKET).list(folder, { search: file, limit: 1 });
  if (!listed?.some((f) => f.name === file)) return { error: "The upload didn't finish. Try again." };

  const { error } = await admin.from("payment_proofs").insert({
    order_id: orderId,
    channel_id: channel_id ?? null,
    storage_path: path,
    claimed_amount,
    reference: reference ?? null,
  });
  if (error) return { error: error.code === "23505" ? "That receipt was already submitted." : "We couldn't save your receipt. Try again." };

  revalidatePath("/admin", "layout");
  revalidatePath(`/order/${token}`);
  return { message: "Receipt sent. We'll verify it and update this page." };
}
