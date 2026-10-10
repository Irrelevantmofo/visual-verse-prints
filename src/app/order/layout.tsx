import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { SHOP } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Order",
  // Order pages are private links: keep them out of search results and out of referrer headers
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function OrderLayout({ children }: LayoutProps<"/order">) {
  return (
    <>
      <header className="bg-ink text-foil-light">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" aria-label="Visual Verse Prints home">
            <Wordmark />
          </Link>
          <a
            href={SHOP.messengerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-foil/60 px-3 py-2 text-sm font-medium hover:bg-foil hover:text-ink"
          >
            <MessageCircle className="size-4" aria-hidden />
            <span className="hidden sm:inline">Message us</span>
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">{children}</main>
      <footer className="border-t border-rule px-4 py-6 text-center text-xs text-graphite">
        Questions about your order? Call or text{" "}
        <a href={SHOP.phoneHref} className="font-medium text-ink underline">
          {SHOP.phone}
        </a>
        .
      </footer>
    </>
  );
}
