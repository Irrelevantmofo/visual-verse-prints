"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { buttonStyles, cx } from "@/components/ui";

/** Copies text to the clipboard and confirms it on the button itself. */
export function CopyButton({ value, label, className, compact = false }: { value: string; label: string; className?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cx(compact ? buttonStyles.ghost : buttonStyles.secondary, compact && "px-2 py-1 text-xs", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this:", value);
        }
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

/** Opens the phone's share sheet (Messenger, SMS, email…) so customers can send themselves the order link. */
export function ShareButton({ url, title }: { url: string; title: string }) {
  // Server render says "no"; the browser answers after hydration (avoids a mismatch)
  const supported = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );
  if (!supported) return null;
  return (
    <button type="button" className={buttonStyles.secondary} onClick={() => navigator.share({ title, url }).catch(() => {})}>
      <Share2 className="size-4" aria-hidden />
      Send to myself
    </button>
  );
}
