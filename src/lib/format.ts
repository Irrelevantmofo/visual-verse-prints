export const TZ = "Asia/Manila";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pesoShort = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

/** Postgres numerics arrive as strings or numbers; normalise. */
export const num = (v: number | string | null | undefined) => Number(v ?? 0);

export const php = (v: number | string | null | undefined) => peso.format(num(v));
export const phpShort = (v: number | string | null | undefined) => pesoShort.format(num(v));
export const pct = (rate: number | string | null | undefined) =>
  `${(num(rate) * 100).toFixed(num(rate) * 100 % 1 === 0 ? 0 : 1)}%`;

/** Today's date (YYYY-MM-DD) in Manila. */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Parse a YYYY-MM-DD string as a UTC-midnight Date for pure date arithmetic. */
export function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function diffDays(a: string, b: string) {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000);
}

/** Monday of the week containing `iso` (matches Excel WEEKDAY(x,2)). */
export function weekStart(iso: string) {
  const d = parseISODate(iso);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  return addDays(iso, -dow);
}

export function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

export function monthEnd(iso: string) {
  const d = parseISODate(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return toISODate(d);
}

export function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISODate(s).getTime());
}

const dateFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dateFmtShort = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });

/** Accepts YYYY-MM-DD or a full timestamp (converted to the Manila calendar date). */
const toDay = (s: string) => (s.length > 10 ? timestampToISODate(s) : s);
export const fmtDate = (iso: string | null | undefined) => (iso ? dateFmt.format(parseISODate(toDay(iso))) : "—");
export const fmtDateShort = (iso: string | null | undefined) => (iso ? dateFmtShort.format(parseISODate(toDay(iso))) : "—");
export const fmtMonth = (iso: string) => monthFmt.format(parseISODate(monthStart(iso)));

/** Timestamp → Manila calendar date. */
export function timestampToISODate(ts: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ts));
}
