import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { num } from "@/lib/format";
import type { FulfilmentMethod, OrderFile, OrderItem, OrderSummary, PaymentChannel, PaymentProof } from "@/types/db";

/**
 * Website ordering, customer side. Customers have no accounts: they act on one order through an unguessable link.
 * Everything here uses the service-role client, so every function must check the order token (or be safe for
 * anyone to call) before touching data.
 */

export const PROOFS_BUCKET = "payment-proofs";
export const QR_BUCKET = "payment-qr";
export const FILES_BUCKET = "order-files";

/** Limits that keep one visitor (or one leaked link) from flooding the shop. */
export const ORDER_LIMITS = {
  itemsPerOrder: 20,
  ordersPerIpPerHour: 5,
  ordersPerHourSitewide: 60,
  proofsPerOrder: 12,
  pendingProofsPerOrder: 4,
} as const;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function newOrderToken() {
  return randomBytes(24).toString("base64url"); // 32 URL-safe characters, 192 bits
}

export function isOrderToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** Salted hash of the caller's IP, for rate limiting only (the raw address is never stored). */
export async function callerIpHash() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${ip}:${process.env.SUPABASE_SECRET_KEY ?? ""}`).digest("hex").slice(0, 32);
}

export async function isOrderingEnabled() {
  if (!process.env.SUPABASE_SECRET_KEY) return false;
  // Local testing only: preview ordering without switching it on for real customers. Ignored in production builds.
  if (process.env.NODE_ENV !== "production" && process.env.ORDERING_PREVIEW === "1") return true;
  const { data } = await createAdminClient().from("settings").select("online_ordering_enabled").maybeSingle();
  return Boolean(data?.online_ordering_enabled);
}

/** The active agent behind an order-link code (/order?ref=…), if any. */
export async function agentForCode(code: unknown): Promise<{ id: string; name: string } | null> {
  if (typeof code !== "string" || !/^[a-z0-9]{6,20}$/.test(code) || !process.env.SUPABASE_SECRET_KEY) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, full_name")
    .eq("referral_code", code)
    .eq("role", "agent")
    .eq("active", true)
    .maybeSingle();
  return data ? { id: data.id as string, name: (data.full_name as string) || "our agent" } : null;
}

export type CustomerOrder = {
  order: OrderSummary & {
    public_token: string;
    customer_notes: string | null;
    fulfilment: FulfilmentMethod | null;
    delivery_name: string | null;
    delivery_phone: string | null;
    delivery_address: string | null;
  };
  items: OrderItem[];
  proofs: (PaymentProof & { url: string | null })[];
  files: OrderFile[];
  channels: PaymentChannel[];
};

/** Everything the order page shows, or null when the link doesn't match an order. */
export async function getCustomerOrder(token: string): Promise<CustomerOrder | null> {
  if (!isOrderToken(token) || !process.env.SUPABASE_SECRET_KEY) return null;
  const admin = createAdminClient();

  // The order_summary view predates these columns, so resolve the token on the table first.
  const { data: base } = await admin
    .from("orders")
    .select("id, public_token, customer_notes, fulfilment, delivery_name, delivery_phone, delivery_address")
    .eq("public_token", token)
    .maybeSingle();
  if (!base) return null;

  const [{ data: summary }, { data: items }, { data: proofs }, { data: files }, { data: channels }] = await Promise.all([
    admin.from("order_summary").select("*").eq("id", base.id).single(),
    admin.from("order_items").select("*").eq("order_id", base.id).order("position"),
    admin.from("payment_proofs").select("*").eq("order_id", base.id).order("created_at", { ascending: false }),
    admin.from("order_files").select("*").eq("order_id", base.id).order("created_at"),
    admin.from("payment_channels").select("*").eq("active", true).order("sort_order").order("created_at"),
  ]);
  if (!summary) return null;

  const proofRows = (proofs ?? []) as PaymentProof[];
  // Short-lived links so the customer can see what they uploaded; the bucket itself is private.
  const signed = proofRows.length
    ? await admin.storage.from(PROOFS_BUCKET).createSignedUrls(
        proofRows.map((p) => p.storage_path),
        60 * 60,
      )
    : { data: [] };

  return {
    order: {
      ...(summary as OrderSummary),
      total_amount: num(summary.total_amount),
      paid_amount: num(summary.paid_amount),
      balance: num(summary.balance),
      public_token: base.public_token as string,
      customer_notes: (base.customer_notes as string | null) ?? null,
      fulfilment: (base.fulfilment as FulfilmentMethod | null) ?? null,
      delivery_name: (base.delivery_name as string | null) ?? null,
      delivery_phone: (base.delivery_phone as string | null) ?? null,
      delivery_address: (base.delivery_address as string | null) ?? null,
    },
    items: ((items ?? []) as OrderItem[]).map((i) => ({ ...i, qty: num(i.qty), amount: num(i.amount) })),
    proofs: proofRows.map((p, i) => ({
      ...p,
      claimed_amount: p.claimed_amount == null ? null : num(p.claimed_amount),
      url: signed.data?.[i]?.signedUrl ?? null,
    })),
    files: (files ?? []) as OrderFile[],
    channels: (channels ?? []) as PaymentChannel[],
  };
}

/** This site's origin as the visitor sees it. */
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}

/** Absolute URL of an order page, for links and the phone-handoff QR. */
export async function orderUrl(token: string) {
  return `${await siteOrigin()}/order/${token}`;
}
