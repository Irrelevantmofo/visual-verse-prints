import Link from "next/link";
import { cx } from "@/components/ui";

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number; key: string }[]; active: string }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b border-rule" aria-label="Filter">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cx(
            "-mb-px border-b-2 px-3 py-2 text-sm",
            t.key === active ? "border-foil font-medium text-ink" : "border-transparent text-graphite hover:text-ink",
          )}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 font-mono text-xs text-graphite">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
