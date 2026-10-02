"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays } from "@/lib/format";
import { inputStyles, buttonStyles, cx } from "@/components/ui";

/** Date selector that writes ?{param}=YYYY-MM-DD (the sheet's "Report Date" cell). */
export function DateNav({ value, today, param = "date", label = "Report date" }: { value: string; today: string; param?: string; label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const go = (date: string) => {
    const params = new URLSearchParams(search);
    if (date === today) params.delete(param);
    else params.set(param, date);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={`dn-${param}`} className="sr-only">
        {label}
      </label>
      <button type="button" className={cx(buttonStyles.secondary, "px-2")} onClick={() => go(addDays(value, -1))} aria-label="Previous day">
        <ChevronLeft className="size-4" />
      </button>
      <input
        id={`dn-${param}`}
        type="date"
        value={value}
        max="2100-12-31"
        onChange={(e) => e.target.value && go(e.target.value)}
        className={cx(inputStyles, "w-auto font-mono")}
      />
      <button type="button" className={cx(buttonStyles.secondary, "px-2")} onClick={() => go(addDays(value, 1))} aria-label="Next day">
        <ChevronRight className="size-4" />
      </button>
      {value !== today && (
        <button type="button" className={buttonStyles.ghost} onClick={() => go(today)}>
          Today
        </button>
      )}
    </div>
  );
}
