/** Visual Verse "V" monogram in a frame, after the shop's Facebook mark. Swap for the official file when available. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none">
      <rect x="1.5" y="1.5" width="45" height="45" stroke="currentColor" strokeWidth="2" />
      <path d="M10 11h7.5L24 31l6.5-20H38L27 39h-6L10 11Z" fill="currentColor" />
      <path d="M24 31c3.5-6 8-9.5 14-10.5-4 3-7 7-9 12.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark />
      <span className="leading-none">
        <span className="block font-serif text-[1.15rem] font-semibold tracking-[0.18em] uppercase">Visual Verse</span>
        <span className="mt-1 flex items-center gap-2 text-[0.6rem] tracking-[0.5em] uppercase opacity-80">
          <span className="h-px w-4 bg-current" />
          Prints
          <span className="h-px w-4 bg-current" />
        </span>
      </span>
    </span>
  );
}
