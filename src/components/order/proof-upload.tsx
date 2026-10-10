"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { requestProofUpload, submitPaymentProof } from "@/lib/actions/ordering";
import { buttonStyles, cx, Field, inputStyles } from "@/components/ui";
import { resizeImage } from "@/lib/resize-image";
import { createClient } from "@/lib/supabase/client";

const ACCEPT = "image/jpeg,image/png,image/webp";
const BUCKET = "payment-proofs";

/**
 * Customer uploads a payment screenshot for the shop to verify. The image is shrunk in the browser, sent straight
 * to private storage through a one-time upload link from the server, then recorded against the order.
 */
export function ProofUploadForm({
  token,
  balance,
  channels,
}: {
  token: string;
  balance: number;
  channels: { id: string; name: string }[];
}) {
  const router = useRouter();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function pick(f: File | undefined) {
    setError(null);
    setDone(null);
    if (!f) {
      clearFile();
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    if (!ACCEPT.split(",").includes(f.type)) {
      setError("Use a JPG, PNG or WebP image (a screenshot works).");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Choose your payment screenshot first.");
      return;
    }
    const form = e.currentTarget;
    const fields = new FormData(form);
    setError(null);
    setDone(null);
    try {
      setBusy("Preparing your screenshot…");
      // Screenshots are tall; keep them readable
      const { blob, ext } = await resizeImage(file, 2000);

      setBusy("Uploading…");
      const started = await requestProofUpload(token, ext);
      if ("error" in started) throw new Error(started.error);
      const { error: uploadError } = await createClient()
        .storage.from(BUCKET)
        .uploadToSignedUrl(started.path, started.uploadToken, blob, { contentType: blob.type });
      if (uploadError) throw new Error("The upload didn't go through. Check your connection and try again.");

      setBusy("Sending to the shop…");
      fields.set("token", token);
      fields.set("path", started.path);
      const result = await submitPaymentProof(null, fields);
      if (result?.error) throw new Error(result.fieldErrors ? Object.values(result.fieldErrors)[0] : result.error);

      form.reset();
      clearFile();
      // Set after the reset so the confirmation stays on screen
      setDone(result?.message ?? "Receipt sent.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-medium">Payment screenshot</p>
        <label
          htmlFor={fileId}
          className={cx(
            "flex cursor-pointer items-center gap-4 rounded-lg border border-dashed border-graphite/40 bg-white p-3 hover:border-foil",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-md bg-paper-2 text-graphite">
            {preview ? (
              // Local preview of the chosen file (a blob: URL, so next/image doesn't apply)
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Chosen screenshot" className="size-full object-cover" />
            ) : (
              <ImagePlus className="size-6" aria-hidden />
            )}
          </span>
          <span className="min-w-0 text-sm">
            <span className="block font-medium">{file ? "Change screenshot" : "Choose screenshot"}</span>
            <span className="block truncate text-xs text-graphite">{file ? file.name : "The receipt or confirmation screen from your banking app."}</span>
          </span>
        </label>
        <input id={fileId} ref={fileRef} type="file" accept={ACCEPT} className="sr-only" disabled={!!busy} onChange={(e) => pick(e.target.files?.[0])} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount you paid (₱)" htmlFor="claimed_amount">
          <input
            id="claimed_amount"
            name="claimed_amount"
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            required
            defaultValue={balance > 0 ? balance.toFixed(2) : ""}
            className={cx(inputStyles, "font-mono")}
          />
        </Field>
        <Field label="Reference number" htmlFor="reference" hint="Optional. It helps us find your payment faster.">
          <input id="reference" name="reference" maxLength={80} autoComplete="off" className={cx(inputStyles, "font-mono")} />
        </Field>
        {channels.length > 1 && (
          <Field label="Paid through" htmlFor="channel_id" className="sm:col-span-2">
            <select id="channel_id" name="channel_id" defaultValue="" className={inputStyles}>
              <option value="">Choose one</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {channels.length === 1 && <input type="hidden" name="channel_id" value={channels[0].id} />}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {done}
        </p>
      )}

      <button disabled={!!busy} className={cx(buttonStyles.gold, "w-full py-3 text-base sm:w-auto sm:px-8")}>
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> {busy}
          </>
        ) : (
          "Send receipt"
        )}
      </button>
    </form>
  );
}
