import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/labels";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const toneClass: Record<Tone, string> = {
  neutral: "bg-paper-2 text-graphite ring-rule",
  gold: "bg-[#f6eedb] text-foil-dark ring-[#e6d4a8]",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-lg border border-rule bg-white", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-wide uppercase">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-graphite">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-lg border p-4",
        emphasis ? "border-ink bg-ink text-paper" : "border-rule bg-white",
      )}
    >
      <p className={cx("font-mono text-[0.68rem] tracking-wider uppercase", emphasis ? "text-foil-light" : "text-graphite")}>
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold tabular">{value}</p>
      {hint && <p className={cx("mt-1 text-xs", emphasis ? "text-paper/70" : "text-graphite")}>{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-wide uppercase sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-graphite">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export const buttonStyles = {
  primary: cx(buttonBase, "bg-ink text-paper hover:bg-ink-3"),
  gold: cx(buttonBase, "bg-foil text-ink hover:bg-foil-light"),
  secondary: cx(buttonBase, "border border-rule bg-white text-ink hover:bg-paper-2"),
  ghost: cx(buttonBase, "text-graphite hover:bg-paper-2 hover:text-ink"),
  danger: cx(buttonBase, "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"),
};

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link className={cx(buttonStyles[variant], className)} {...props} />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold tracking-wide uppercase">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-graphite">{children}</div>}
    </div>
  );
}

/* ── Tables ── */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cx(
        "border-b border-rule bg-paper px-4 py-2.5 text-left font-mono text-[0.68rem] font-medium tracking-wider text-graphite uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}
export function Td({ children, className, ...rest }: ComponentProps<"td">) {
  return (
    <td className={cx("border-b border-rule/70 px-4 py-3 align-top", className)} {...rest}>
      {children}
    </td>
  );
}

/* ── Form fields ── */
export const inputStyles =
  "block w-full rounded-md border border-rule bg-white px-3 py-2 text-sm text-ink placeholder:text-graphite/60 focus:border-foil focus:outline-none focus:ring-2 focus:ring-foil/30";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-700">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-graphite">{hint}</p>
      )}
    </div>
  );
}

export function FormMessage({ state }: { state: { error?: string; message?: string } | null | undefined }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {state.message}
      </p>
    );
  return null;
}
