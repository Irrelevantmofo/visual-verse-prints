"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { buttonStyles, cx } from "@/components/ui";
import { isHostedProductImage, PRODUCT_BUCKET } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

const MAX_EDGE = 1600; // px on the longest side: sharp on the site, small to download
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

function hostOf(link: string) {
  try {
    return new URL(link).hostname;
  } catch {
    return "pasted text";
  }
}

/** Shrink a photo in the browser so phone pictures (5–10 MB) upload as a few hundred KB. */
async function resize(file: File): Promise<{ blob: Blob; ext: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("This image couldn't be processed.");
  return { blob: jpeg, ext: "jpg" };
}

/**
 * Photo picker for the catalog. Uploads straight to Supabase Storage (admins only, enforced by storage policies)
 * and writes the resulting public URL into a hidden form field; the product form saves it.
 */
export function ImageUpload({ name, initialUrl, alt }: { name: string; initialUrl: string | null; alt: string }) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const hostedInitial = isHostedProductImage(initialUrl) ? initialUrl : null;
  const unsupportedLink = initialUrl && !hostedInitial ? initialUrl : null;
  const [url, setUrl] = useState<string | null>(hostedInitial);
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
      const { blob, ext } = await resize(file);
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_BUCKET)
        .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
      if (uploadError) throw new Error(uploadError.message);
      setUrl(supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path).data.publicUrl);
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
        <div className="relative grid aspect-[4/3] w-36 shrink-0 place-items-center overflow-hidden rounded-md border border-rule bg-paper-2 text-graphite">
          {url ? (
            <Image src={url} alt={alt} fill sizes="144px" className="object-cover" />
          ) : busy ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-6" aria-hidden />
          )}
          {url && busy && (
            <span className="absolute inset-0 grid place-items-center bg-white/70">
              <Loader2 className="size-5 animate-spin" aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <label htmlFor={inputId} className={cx(buttonStyles.secondary, "cursor-pointer", busy && "pointer-events-none opacity-50")}>
              {busy ? "Uploading…" : url ? "Replace image" : "Upload image"}
            </label>
            <input
              id={inputId}
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {url && !busy && (
              <button type="button" className={buttonStyles.ghost} onClick={() => setUrl(null)}>
                <Trash2 className="size-4" aria-hidden /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-graphite">
            JPG, PNG or WebP. Landscape photos look best. Shown on the website after you save the product.
          </p>
          {unsupportedLink && !url && (
            <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              The old image link (<span className="break-all">{hostOf(unsupportedLink)}</span>) is a web page, not an image file, so it
              can&apos;t be shown. Upload the image here instead.
            </p>
          )}
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
