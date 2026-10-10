"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { recordOrderFile, requestFileUpload } from "@/lib/actions/ordering";
import { cx } from "@/components/ui";
import { fileExtension, ORDER_FILE_ACCEPT, ORDER_FILE_HINT, ORDER_FILE_MAX_BYTES, ORDER_FILE_TYPES } from "@/lib/order-files";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "order-files";

/**
 * Customer attaches design files to their order. Each file goes straight to private storage through a one-time
 * upload link from the server, then is recorded against the order (which flags the order for the shop).
 */
export function OrderFileUpload({ token, remaining }: { token: string; remaining: number }) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<{ ok: string | null; errors: string[] }>({ ok: null, errors: [] });

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list).slice(0, Math.max(remaining, 0));
    const errors: string[] = [];
    if (files.length < list.length) errors.push(`Only ${remaining} more ${remaining === 1 ? "file" : "files"} can be added to this order.`);
    let sent = 0;
    const supabase = createClient();

    for (const [i, file] of files.entries()) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      if (!ORDER_FILE_TYPES[fileExtension(file.name)]) {
        errors.push(`${file.name}: that file type isn't supported.`);
        continue;
      }
      if (file.size > ORDER_FILE_MAX_BYTES) {
        errors.push(`${file.name}: larger than 20 MB.`);
        continue;
      }
      try {
        const started = await requestFileUpload(token, file.name, file.size);
        if ("error" in started) throw new Error(started.error);
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(started.path, started.uploadToken, file, { contentType: started.contentType });
        if (uploadError) throw new Error("the upload didn't go through. Check your connection and try again.");
        const recorded = await recordOrderFile(token, started.path, file.name);
        if ("error" in recorded) throw new Error(recorded.error);
        sent += 1;
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : "upload failed."}`);
      }
    }

    setBusy(null);
    setNotes({ ok: sent ? `${sent} ${sent === 1 ? "file" : "files"} sent to the shop.` : null, errors });
    if (inputRef.current) inputRef.current.value = "";
    if (sent) router.refresh();
  }

  if (remaining <= 0) return <p className="text-sm text-graphite">This order has the maximum number of files. Message us if you need to send more.</p>;

  return (
    <div>
      <label
        htmlFor={inputId}
        className={cx(
          "flex cursor-pointer items-center gap-4 rounded-lg border border-dashed border-graphite/40 bg-white p-4 hover:border-foil",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-md bg-paper-2 text-graphite">
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <FileUp className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 text-sm">
          <span className="block font-medium">{busy ?? "Choose design files"}</span>
          <span className="block text-xs text-graphite">{ORDER_FILE_HINT}.</span>
        </span>
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple
        accept={ORDER_FILE_ACCEPT}
        className="sr-only"
        disabled={!!busy}
        onChange={(e) => onFiles(e.target.files)}
      />
      {notes.ok && (
        <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notes.ok}
        </p>
      )}
      {notes.errors.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {notes.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
