import { LogoMark } from "@/components/logo";

function RegistrationTarget({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 1v22M1 12h22" />
    </svg>
  );
}

/** Hero illustration: an imposed press sheet with trim marks, laid out like a real gang-run. */
export function PressSheet() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem] [animation:sheet-in_.9s_cubic-bezier(.2,.7,.2,1)_.15s_both] [transform:rotate(-3deg)]">
      <div className="crop-marks bg-[#f4f2ec] p-7 text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)] [--crop-color:#0e0d0b55] [--crop:22px] sm:p-9">
        {/* sheet header: slug line like a real job ticket */}
        <div className="flex items-center justify-between font-mono text-[0.55rem] tracking-widest text-graphite uppercase">
          <span>VVP · Job 0427 · 4/0 CMYK</span>
          <RegistrationTarget className="size-4 text-ink/60" />
        </div>

        <div className="mt-5 grid grid-cols-6 gap-3">
          {/* calling card, front */}
          <div className="col-span-4 flex aspect-[1.75] flex-col justify-between rounded-[3px] bg-ink p-4 text-foil-light">
            <LogoMark className="size-7" />
            <div>
              <p className="font-serif text-lg leading-none font-semibold tracking-[0.15em] uppercase">Visual Verse</p>
              <p className="mt-1 font-mono text-[0.5rem] tracking-[0.4em] text-paper/60 uppercase">Prints · Caloocan</p>
            </div>
          </div>

          {/* round sticker with die line */}
          <div className="col-span-2 flex items-center justify-center">
            <div className="relative grid aspect-square w-full place-items-center rounded-full border border-dashed border-magenta/60 p-1.5">
              <div className="grid size-full place-items-center rounded-full bg-paper text-center ring-1 ring-ink/15">
                <div>
                  <LogoMark className="mx-auto size-6 text-foil-dark" />
                  <p className="mt-1 font-serif text-[0.6rem] font-semibold tracking-widest uppercase">Visual Verse</p>
                </div>
              </div>
            </div>
          </div>

          {/* cup sleeve, flat */}
          <div className="col-span-6 mt-1">
            <svg viewBox="0 0 300 70" className="w-full" aria-hidden="true">
              <path d="M8 6 Q150 -10 292 6 L268 64 Q150 52 32 64 Z" fill="#c9a55a" />
              <path d="M8 6 Q150 -10 292 6 L268 64 Q150 52 32 64 Z" fill="none" stroke="#d6007e" strokeDasharray="3 3" strokeOpacity=".5" transform="translate(0 0)" />
              <text x="150" y="40" textAnchor="middle" fontFamily="var(--font-cormorant), serif" fontSize="17" fontWeight="600" letterSpacing="5" fill="#0e0d0b">
                VISUAL VERSE
              </text>
            </svg>
          </div>

          {/* labels */}
          {["Matte", "Glossy", "Clear"].map((finish) => (
            <div
              key={finish}
              className="col-span-2 flex aspect-[1.2] flex-col justify-between rounded-[3px] border border-ink/15 bg-white p-2.5"
            >
              <span className="font-mono text-[0.5rem] tracking-widest text-graphite uppercase">Label</span>
              <span className="font-display text-sm font-semibold uppercase">{finish}</span>
            </div>
          ))}
        </div>

        {/* color control bar printed along the sheet edge */}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-3 flex-1 overflow-hidden">
            {["bg-cyan", "bg-magenta", "bg-yellow", "bg-ink", "bg-foil", "bg-cyan/50", "bg-magenta/50", "bg-yellow/50", "bg-ink/50"].map(
              (c, i) => (
                <span key={i} className={`flex-1 ${c}`} />
              ),
            )}
          </div>
          <RegistrationTarget className="size-4 text-ink/60" />
        </div>
      </div>
    </div>
  );
}

/** Full-bleed CMYK + foil registration strip used as a section divider. */
export function RegistrationStrip() {
  return (
    <div aria-hidden className="relative flex h-2">
      <span className="flex-1 bg-cyan" />
      <span className="flex-1 bg-magenta" />
      <span className="flex-1 bg-yellow" />
      <span className="flex-1 bg-ink-3" />
      <span className="flex-[2] bg-foil" />
    </div>
  );
}
