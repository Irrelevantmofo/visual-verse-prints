"use client";

import Image from "next/image";
import { useActionState, useId, useRef, useState } from "react";
import { Loader2, QrCode, Trash2 } from "lucide-react";
import { saveChannel } from "@/lib/actions/payments";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";
import { PAYMENT_METHOD } from "@/lib/labels";
import { resizeImage } from "@/lib/resize-image";
import { createClient } from "@/lib/supabase/client";
import type { PaymentChannel } from "@/types/db";

const ACCEPT = "image/jpeg,image/png,image/webp";
const BUCKET = "payment-qr";

/** One QR image, uploaded straight to the public payment-qr bucket (admins only, enforced by storage policies). */
function QrUpload({ initialUrl, name }: { initialUrl: string | null; name: string }) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Use a JPG, PNG or WebP image.");
      return;
    }
    setBusy(true);
    try {
      // Keep small QR images exactly as they are; only shrink oversized photos of a QR
      const small = file.size <= 1_500_000;
      const upload = small ? { blob: file as Blob, ext: file.type.split("/")[1].replace("jpeg", "jpg") } : await resizeImage(file, 1400);
      const path = `${crypto.randomUUID()}.${upload.ext}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, upload.blob, { contentType: upload.blob.type, cacheControl: "3600" });
      if (uploadError) throw new Error(uploadError.message);
      setUrl(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={url ?? ""} />
      <div className="flex items-start gap-4">
        <div className="relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-md border border-rule bg-white text-graphite">
          {busy ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : url ? (
            <Image src={url} alt="Payment QR code" fill sizes="112px" unoptimized className="object-contain p-1" />
          ) : (
            <QrCode className="size-7" aria-hidden />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label htmlFor={inputId} className={cx(buttonStyles.secondary, "cursor-pointer", busy && "pointer-events-none opacity-50")}>
              {busy ? "Uploading…" : url ? "Replace QR" : "Upload QR"}
            </label>
            <input id={inputId} ref={fileRef} type="file" accept={ACCEPT} className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
            {url && !busy && (
              <button type="button" className={buttonStyles.ghost} onClick={() => setUrl(null)}>
                <Trash2 className="size-4" aria-hidden /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-graphite">The QR image from your bank or e-wallet app. Customers scan it, or save it to their phone.</p>
          {error && (
            <p role="alert" className="text-xs text-rose-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChannelForm({ channel, nextSort }: { channel?: PaymentChannel; nextSort?: number }) {
  const [state, action, pending] = useActionState(saveChannel, null);
  const fe = state?.fieldErrors ?? {};
  const k = channel?.id.slice(0, 8) ?? "new";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {channel && <input type="hidden" name="id" value={channel.id} />}
      <Field label="Name" htmlFor={`ch-name-${k}`} error={fe.name} hint="What customers see, e.g. BPI.">
        <input id={`ch-name-${k}`} name="name" required defaultValue={channel?.name} className={inputStyles} />
      </Field>
      <Field label="Type" htmlFor={`ch-method-${k}`} hint="Recorded on payments verified through this channel.">
        <select id={`ch-method-${k}`} name="method" defaultValue={channel?.method ?? "bank_transfer"} className={inputStyles}>
          {Object.entries(PAYMENT_METHOD)
            .filter(([key]) => key !== "cash")
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Account name" htmlFor={`ch-accname-${k}`}>
        <input id={`ch-accname-${k}`} name="account_name" defaultValue={channel?.account_name ?? ""} className={inputStyles} />
      </Field>
      <Field label="Account / mobile number" htmlFor={`ch-accno-${k}`}>
        <input id={`ch-accno-${k}`} name="account_number" defaultValue={channel?.account_number ?? ""} className={cx(inputStyles, "font-mono")} />
      </Field>
      <div className="sm:col-span-2">
        <p className="mb-1 text-sm font-medium">QR code</p>
        <QrUpload name="qr_url" initialUrl={channel?.qr_url ?? null} />
        {fe.qr_url && <p className="mt-1 text-xs text-rose-700">{fe.qr_url}</p>}
      </div>
      <Field label="Note to customers" htmlFor={`ch-note-${k}`} className="sm:col-span-2" hint="Optional, e.g. “Include your order number in the message.”">
        <textarea id={`ch-note-${k}`} name="instructions" rows={2} defaultValue={channel?.instructions ?? ""} className={inputStyles} />
      </Field>
      <div className="flex items-end gap-4 sm:col-span-2">
        <Field label="Order" htmlFor={`ch-sort-${k}`}>
          <input
            id={`ch-sort-${k}`}
            name="sort_order"
            type="number"
            defaultValue={channel?.sort_order ?? nextSort ?? 0}
            className={cx(inputStyles, "w-24 font-mono")}
          />
        </Field>
        <label className="inline-flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={channel?.active ?? true} className="size-4 accent-[var(--color-foil-dark)]" />
          Show to customers
        </label>
      </div>
      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <button disabled={pending} className={channel ? buttonStyles.secondary : buttonStyles.primary}>
          {pending ? "Saving…" : channel ? "Save channel" : "Add channel"}
        </button>
      </div>
    </form>
  );
}
