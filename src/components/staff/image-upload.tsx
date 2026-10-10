"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from "lucide-react";
import { cx } from "@/components/ui";
import { isHostedProductImage, MAX_PRODUCT_IMAGES, PRODUCT_BUCKET } from "@/lib/images";
import { IMAGE_ACCEPT, resizeImage } from "@/lib/resize-image";
import { createClient } from "@/lib/supabase/client";

const ACCEPT = IMAGE_ACCEPT;

function hostOf(link: string) {
  try {
    return new URL(link).hostname;
  } catch {
    return "pasted text";
  }
}

/**
 * Photo gallery picker for the catalog. Uploads straight to Supabase Storage (admins only, enforced by storage
 * policies) and writes the ordered list of public URLs into a hidden form field as JSON; the product form saves it.
 * The first photo is the cover.
 */
export function ImageGalleryUpload({
  name,
  initialUrls,
  legacyLink,
  alt,
}: {
  name: string;
  initialUrls: string[];
  /** An old pasted link that isn't an image file (e.g. a Google Drive share page) */
  legacyLink?: string | null;
  alt: string;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>(() => initialUrls.filter(isHostedProductImage));
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const room = MAX_PRODUCT_IMAGES - urls.length - uploading;
  const unsupportedLink = legacyLink && !isHostedProductImage(legacyLink) ? legacyLink : null;

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const all = Array.from(list);
    const valid = all.filter((f) => ACCEPT.split(",").includes(f.type));
    const files = valid.slice(0, Math.max(room, 0));
    const notes: string[] = [];
    if (valid.length < all.length) notes.push(`${all.length - valid.length} skipped (use JPG, PNG or WebP)`);
    if (files.length < valid.length) notes.push(`only ${MAX_PRODUCT_IMAGES} photos per product`);

    setUploading((n) => n + files.length);
    const supabase = createClient();
    let failed = 0;
    // One at a time keeps the order the admin picked and is gentle on slow connections
    for (const file of files) {
      try {
        const { blob, ext } = await resizeImage(file);
        const path = `products/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_BUCKET)
          .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (uploadError) throw new Error(uploadError.message);
        const publicUrl = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path).data.publicUrl;
        setUrls((prev) => [...prev, publicUrl]);
      } catch {
        failed += 1;
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (failed) notes.unshift(`${failed} ${failed === 1 ? "photo" : "photos"} failed to upload. Try again`);
    if (notes.length) setError(notes.join(" · "));
    if (fileRef.current) fileRef.current.value = "";
  }

  const move = (index: number, by: -1 | 1) =>
    setUrls((prev) => {
      const next = [...prev];
      const target = index + by;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(urls)} />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {urls.map((url, i) => (
          <li key={url} className="group relative aspect-[4/3] overflow-hidden rounded-md border border-rule bg-paper-2">
            <Image src={url} alt={`${alt} photo ${i + 1}`} fill sizes="200px" className="object-cover" />
            {i === 0 && (
              <span className="absolute top-1.5 left-1.5 rounded bg-ink px-1.5 py-0.5 font-mono text-[0.6rem] tracking-wider text-foil-light uppercase">
                Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => setUrls((prev) => prev.filter((u) => u !== url))}
              className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-ink/80 text-paper hover:bg-rose-700"
              aria-label={`Remove photo ${i + 1}`}
            >
              <X className="size-3.5" />
            </button>
            {urls.length > 1 && (
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="grid size-6 place-items-center rounded-full bg-ink/80 text-paper hover:bg-ink disabled:opacity-30"
                  aria-label={`Move photo ${i + 1} earlier`}
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === urls.length - 1}
                  className="grid size-6 place-items-center rounded-full bg-ink/80 text-paper hover:bg-ink disabled:opacity-30"
                  aria-label={`Move photo ${i + 1} later`}
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}

        {Array.from({ length: uploading }, (_, i) => (
          <li key={`up-${i}`} className="grid aspect-[4/3] place-items-center rounded-md border border-dashed border-rule bg-paper-2 text-graphite">
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </li>
        ))}

        {room > 0 && (
          <li>
            <label
              htmlFor={inputId}
              className={cx(
                "grid aspect-[4/3] cursor-pointer place-items-center rounded-md border border-dashed border-graphite/40 bg-white text-center text-sm text-graphite hover:border-foil hover:text-ink",
                uploading > 0 && "pointer-events-none opacity-50",
              )}
            >
              <span>
                <ImagePlus className="mx-auto mb-1 size-5" aria-hidden />
                {urls.length ? "Add photos" : "Upload photos"}
              </span>
            </label>
            <input
              id={inputId}
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              disabled={uploading > 0}
              onChange={(e) => onFiles(e.target.files)}
            />
          </li>
        )}
      </ul>

      <p className="mt-2 text-xs text-graphite">
        {urls.length} of {MAX_PRODUCT_IMAGES} photos. Select several at once. The first is the cover; use the arrows to reorder. Changes show on the
        website after you save the product.
      </p>
      {uploading > 0 && (
        <p role="status" className="mt-1 text-xs text-graphite">
          Uploading {uploading} {uploading === 1 ? "photo" : "photos"}…
        </p>
      )}
      {unsupportedLink && urls.length === 0 && (
        <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
          The old image link (<span className="break-all">{hostOf(unsupportedLink)}</span>) is a web page, not an image file, so it can&apos;t be
          shown. Upload the photos here instead.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
