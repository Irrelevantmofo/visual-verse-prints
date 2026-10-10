"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  agentForCode,
  callerIpHash,
  FILES_BUCKET,
  isOrderingEnabled,
  isOrderToken,
  newOrderToken,
  ORDER_LIMITS,
  PROOFS_BUCKET,
} from "@/lib/ordering";
import { fileExtension, ORDER_FILE_MAX_BYTES, ORDER_FILE_TYPES, ORDER_FILES_PER_ORDER } from "@/lib/order-files";
import { itemsSummary } from "@/lib/format";
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
  // "I need a different size or spec than listed": the shop prices it
  custom_spec: z.boolean().optional().default(false),
});

const orderSchema = z
  .object({
    client_name: z.string().trim().min(2, "Enter your name.").max(100),
    client_contact: z.string().trim().min(7, "Enter a mobile number or email we can reach you on.").max(120),
    customer_notes: trimmedOptional(1000),
    fulfilment: z.enum(["pickup", "lalamove", "courier"], { error: "Choose how you'll get your order." }),
    delivery_name: trimmedOptional(100),
    delivery_phone: trimmedOptional(40),
    delivery_address: trimmedOptional(400),
    ref: trimmedOptional(20),
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
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment !== "courier") return;
    if (!v.delivery_name) ctx.addIssue({ code: "custom", path: ["delivery_name"], message: "Enter the recipient's name." });
    if (!v.delivery_phone) ctx.addIssue({ code: "custom", path: ["delivery_phone"], message: "Enter the recipient's mobile number." });
    if (!v.delivery_address || v.delivery_address.length < 10) {
      ctx.addIssue({ code: "custom", path: ["delivery_address"], message: "Enter the full delivery address." });
    }
  });

export async function createWebOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isOrderingEnabled())) return { error: "Online ordering isn't open yet. Message us and we'll take your order." };

  const parsed = orderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const { items, website, ref, ...customer } = parsed.data;
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

  // Names and prices always come from the catalog, whatever the browser sent
  const productIds = [...new Set(items.map((i) => i.product_id).filter((id): id is string => id !== null))];
  const catalog = new Map<string, { name: string; fixedPrice: number | null }>();
  if (productIds.length) {
    const { data: products } = await admin.from("products").select("id, name, fixed_price, starting_price").in("id", productIds).eq("active", true);
    for (const p of products ?? []) {
      const price = Number(p.starting_price);
      catalog.set(p.id as string, { name: p.name as string, fixedPrice: p.fixed_price && price > 0 ? price : null });
    }
    if (catalog.size !== productIds.length) return { error: "One of the products is no longer available. Refresh the page and try again." };
  }

  const lines = items.map((it, position) => {
    const product = it.product_id ? catalog.get(it.product_id)! : null;
    const name = product ? product.name : it.description;
    // A fixed-price item ordered as listed is priced now; anything else waits for the shop
    const instant = product?.fixedPrice != null && !it.custom_spec;
    const note = it.custom_spec ? `different size/spec: ${it.details ?? "see notes"}` : it.details;
    return {
      product_id: it.product_id,
      description: note ? `${name} (${note})` : name,
      qty: it.qty,
      amount: instant ? Math.round(product!.fixedPrice! * it.qty * 100) / 100 : 0,
      position,
      instant,
    };
  });
  for (const [i, it] of items.entries()) {
    if (it.custom_spec && !it.details) {
      return { error: "Check the highlighted fields and try again.", fieldErrors: { items: `Tell us the size or spec you need for product ${i + 1}.` } };
    }
  }

  // Payable right away only when every line has a fixed price and no shipping fee has to be added
  const payNow = lines.every((l) => l.instant) && customer.fulfilment !== "courier";
  const agent = await agentForCode(ref);
  const now = new Date().toISOString();

  // Orders through an agent's link appear in that agent's referrals, already approved
  let referralId: string | null = null;
  if (agent) {
    const { data: referral } = await admin
      .from("referrals")
      .insert({
        agent_id: agent.id,
        client_name: customer.client_name,
        client_contact: customer.client_contact,
        interested_in: itemsSummary(lines),
        status: "approved",
        review_notes: "Ordered on the website through your link.",
        reviewed_at: now,
      })
      .select("id")
      .single();
    referralId = (referral?.id as string | undefined) ?? null;
  }

  const token = newOrderToken();
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      source: "website",
      order_status: payNow ? "awaiting_payment" : "pending_review",
      agent_id: agent?.id ?? null,
      referral_id: referralId,
      client_name: customer.client_name,
      client_contact: customer.client_contact,
      customer_notes: customer.customer_notes ?? null,
      fulfilment: customer.fulfilment,
      delivery_name: customer.fulfilment === "courier" ? customer.delivery_name : null,
      delivery_phone: customer.fulfilment === "courier" ? customer.delivery_phone : null,
      delivery_address: customer.fulfilment === "courier" ? customer.delivery_address : null,
      public_token: token,
      created_ip_hash: ipHash,
      customer_activity_at: now,
    })
    .select("id")
    .single();
  if (error) {
    if (referralId) await admin.from("referrals").delete().eq("id", referralId);
    return { error: "We couldn't save your order. Try again in a moment." };
  }

  const { error: itemsError } = await admin
    .from("order_items")
    .insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        description: l.description,
        qty: l.qty,
        amount: l.amount,
        position: l.position,
      })),
    );
  if (itemsError) {
    await admin.from("orders").delete().eq("id", order.id);
    if (referralId) await admin.from("referrals").delete().eq("id", referralId);
    return { error: "We couldn't save your order. Try again in a moment." };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/agent", "layout");
  redirect(`/order/${token}?placed=1`);
}

/* ───────────────────────── Shared order lookup ───────────────────────── */

async function orderByToken(token: unknown) {
  if (!isOrderToken(token)) return null;
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, order_status").eq("public_token", token).maybeSingle();
  return order ? { admin, orderId: order.id as string, status: order.order_status as string } : null;
}

/** Marks the order as having new customer activity, so admins see it flagged. */
async function touchActivity(admin: ReturnType<typeof createAdminClient>, orderId: string, token: string) {
  await admin.from("orders").update({ customer_activity_at: new Date().toISOString() }).eq("id", orderId);
  revalidatePath("/admin", "layout");
  revalidatePath(`/order/${token}`);
}

/* ───────────────────────── Artwork files ───────────────────────── */

const FILE_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

async function uploadableOrder(token: unknown) {
  const found = await orderByToken(token);
  if (!found) return { error: "This order link isn't valid." } as const;
  if (found.status === "cancelled" || found.status === "delivered") return { error: "This order is closed, so files can't be added." } as const;
  const { count } = await found.admin.from("order_files").select("id", { count: "exact", head: true }).eq("order_id", found.orderId);
  if ((count ?? 0) >= ORDER_FILES_PER_ORDER) {
    return { error: `This order already has ${ORDER_FILES_PER_ORDER} files. Message us if you need to send more.` } as const;
  }
  return found;
}

/** Step 1: a one-time link that lets the browser put one design file in the private bucket. */
export async function requestFileUpload(
  token: string,
  fileName: string,
  size: number,
): Promise<{ error: string } | { path: string; uploadToken: string; contentType: string }> {
  const ext = fileExtension(String(fileName));
  const contentType = ORDER_FILE_TYPES[ext];
  if (!contentType) return { error: "That file type isn't supported." };
  if (!(size > 0) || size > ORDER_FILE_MAX_BYTES) return { error: "Each file can be up to 20 MB." };
  const found = await uploadableOrder(token);
  if ("error" in found) return { error: found.error as string };

  const path = `${found.orderId}/${randomUUID()}.${ext}`;
  const { data, error } = await found.admin.storage.from(FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "We couldn't start the upload. Try again." };
  return { path, uploadToken: data.token, contentType };
}

/** Step 2: record the uploaded file against the order. */
export async function recordOrderFile(token: string, path: string, fileName: string): Promise<{ error: string } | { ok: true }> {
  if (typeof path !== "string" || !FILE_PATH.test(path)) return { error: "That upload isn't valid." };
  const found = await uploadableOrder(token);
  if ("error" in found) return { error: found.error as string };

  const [folder, file] = path.split("/");
  if (folder !== found.orderId) return { error: "That upload doesn't belong to this order." };
  const { data: listed } = await found.admin.storage.from(FILES_BUCKET).list(folder, { search: file, limit: 1 });
  const stored = listed?.find((f) => f.name === file);
  if (!stored) return { error: "The upload didn't finish. Try again." };

  // Keep the customer's file name for display, minus path separators and control characters
  const name =
    [...String(fileName)]
      .filter((ch) => ch >= " " && ch !== "/" && ch !== "\\")
      .join("")
      .trim()
      .slice(0, 150) || file;
  const { error } = await found.admin.from("order_files").insert({
    order_id: found.orderId,
    storage_path: path,
    file_name: name,
    size_bytes: (stored.metadata?.size as number | undefined) ?? null,
    content_type: (stored.metadata?.mimetype as string | undefined) ?? null,
  });
  if (error) return { error: error.code === "23505" ? "That file was already added." : "We couldn't save that file. Try again." };

  await touchActivity(found.admin, found.orderId, token);
  return { ok: true };
}

/* ───────────────────────── Payment receipts ───────────────────────── */

async function payableOrder(token: unknown) {
  const found = await orderByToken(token);
  if (!found) return { error: "This order link isn't valid." } as const;
  if (found.status === "pending_review") return { error: "We're still confirming your price. You can pay once it's confirmed." } as const;
  if (found.status === "cancelled") return { error: "This order was cancelled." } as const;

  const { data: proofs } = await found.admin.from("payment_proofs").select("status").eq("order_id", found.orderId);
  const all = proofs ?? [];
  if (all.length >= ORDER_LIMITS.proofsPerOrder) return { error: "This order has reached its upload limit. Message us for help." } as const;
  if (all.filter((p) => p.status === "pending").length >= ORDER_LIMITS.pendingProofsPerOrder) {
    return { error: "We're still checking the receipts you already sent. You can add more once those are reviewed." } as const;
  }
  return found;
}

const PROOF_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/;

/** Step 1 of a receipt upload: a one-time link that lets the browser put one image in the private bucket. */
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

  await touchActivity(admin, orderId, token);
  return { message: "Receipt sent. We'll verify it and update this page." };
}
