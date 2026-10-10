import Link from "next/link";
import { ArrowRight, MessageCircle, ExternalLink, Phone, Mail } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/logo";
import { PressSheet, RegistrationStrip } from "@/components/marketing/press-sheet";
import { ProductGallery } from "@/components/marketing/product-gallery";
import { SOCIALS } from "@/components/marketing/social-links";
import { getCatalog, SHOP } from "@/lib/catalog";
import { isOrderingEnabled } from "@/lib/ordering";
import { phpShort } from "@/lib/format";
import { productPhotos } from "@/lib/images";

export const revalidate = 300;

const STEPS = [
  {
    title: "Message us",
    body: "Tell us what you need, how many, and when. Send your file, or just a photo of the idea.",
  },
  {
    title: "Get your quote",
    body: "We reply with an itemized price. Quotes stay valid for 14 days.",
  },
  {
    title: "Approve the layout",
    body: "You get a layout to check. We print once you give the go signal.",
  },
  {
    title: "Pick up or have it delivered",
    body: "We tell you when it's ready. Collect it from the shop or have it sent to you.",
  },
];

// How many columns the closing tile spans, by how many products sit in the last row (keys = count % columns)
const CTA_SPAN_SM = ["sm:col-span-2", "sm:col-span-1"];
const CTA_SPAN_LG = ["lg:col-span-3", "lg:col-span-2", "lg:col-span-1"];

export default async function HomePage() {
  const [products, orderingEnabled] = await Promise.all([getCatalog(), isOrderingEnabled()]);
  // Show the photo area on every card as soon as at least one product has photos
  const showPhotos = products.some((p) => productPhotos(p).length > 0);

  return (
    <>
      {/* ── Header ── */}
      <header className="absolute inset-x-0 top-0 z-20 text-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <Link href="/" aria-label="Visual Verse Prints home" className="text-foil-light">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-paper/80 md:flex">
            <a href="#services" className="hover:text-paper">Services</a>
            <a href="#process" className="hover:text-paper">How it works</a>
            <a href="#about" className="hover:text-paper">About</a>
            <a href="#contact" className="hover:text-paper">Contact</a>
          </nav>
          <a
            href={SHOP.messengerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-foil/60 px-3 py-2 text-sm font-medium text-foil-light hover:bg-foil hover:text-ink"
          >
            <MessageCircle className="size-4" aria-hidden />
            <span className="hidden sm:inline">Message us</span>
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-ink text-paper">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(var(--color-foil)_1px,transparent_1px)] [background-size:22px_22px]"
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pt-32 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-40 lg:pb-28">
            <div className="[animation:fade-up_.7s_ease-out_both]">
              <p className="font-mono text-xs tracking-[0.3em] text-foil uppercase">
                Printing services · {SHOP.city}
              </p>
              <h1 className="mt-6 font-display text-[clamp(3.4rem,9vw,7.5rem)] leading-[0.86] font-bold tracking-tight uppercase">
                Every print
                <br />
                tells a{" "}
                <span className="foil-text font-serif text-[1.08em] font-medium normal-case italic tracking-normal [animation:foil-sweep_2.4s_ease-out_.3s_both]">
                  story.
                </span>
              </h1>
              <p className="mt-7 max-w-lg text-lg leading-relaxed text-paper/75">
                Stickers, calling cards, invitations, cup sleeves, packaging and more. Send us your idea or your file.
                We&apos;ll quote it, proof it, and print it.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href={SHOP.messengerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-foil px-5 py-3 font-medium text-ink hover:bg-foil-light"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  Message us for a quote
                </a>
                <a
                  href="#services"
                  className="inline-flex items-center gap-2 rounded-md border border-paper/25 px-5 py-3 font-medium text-paper hover:border-paper/60"
                >
                  See what we print
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              </div>
              <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-paper/10 pt-6 text-sm">
                <div>
                  <dt className="font-mono text-[0.65rem] tracking-widest text-paper/50 uppercase">Registered</dt>
                  <dd className="mt-1">DTI / BIR</dd>
                </div>
                <div>
                  <dt className="font-mono text-[0.65rem] tracking-widest text-paper/50 uppercase">Based in</dt>
                  <dd className="mt-1">{SHOP.city}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[0.65rem] tracking-widest text-paper/50 uppercase">Release</dt>
                  <dd className="mt-1">Pick-up or delivery</dd>
                </div>
              </dl>
            </div>

            <PressSheet />
          </div>
          <RegistrationStrip />
        </section>

        {/* ── Services ── */}
        <section id="services" className="scroll-mt-8 bg-paper">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="font-mono text-xs tracking-[0.3em] text-foil-dark uppercase">What we print</p>
                <h2 className="mt-3 font-display text-5xl font-bold uppercase sm:text-6xl">
                  {products.length} ways to put it on paper
                </h2>
              </div>
            </div>

            <ul className="mt-12 grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <li key={p.id} className="group relative flex flex-col bg-white transition-colors hover:bg-ink hover:text-paper">
                  {showPhotos &&
                    (productPhotos(p).length > 0 ? (
                      <ProductGallery images={productPhotos(p)} name={p.name} />
                    ) : (
                      // No photos yet: a quiet branded tile so the grid stays even
                      <div
                        aria-hidden
                        className="grid aspect-[4/3] place-items-center bg-paper-2 text-ink/10 transition-colors group-hover:bg-ink-2 group-hover:text-paper/10"
                      >
                        <LogoMark className="size-16" />
                      </div>
                    ))}
                  <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between font-mono text-[0.65rem] tracking-widest text-graphite uppercase group-hover:text-foil">
                    <span>{p.category}</span>
                    <span aria-hidden className="h-px flex-1 mx-3 border-t border-dashed border-rule group-hover:border-paper/20" />
                    <span>{p.unit ? "Stock item" : "Custom"}</span>
                  </div>
                  <h3 className="mt-5 font-display text-3xl font-semibold uppercase">{p.name}</h3>
                  {p.description && <p className="mt-2 flex-1 text-sm leading-relaxed text-graphite group-hover:text-paper/70">{p.description}</p>}
                  <p className="mt-6 text-sm">
                    {p.starting_price != null ? (
                      <>
                        {!p.fixed_price && <span className="text-graphite group-hover:text-paper/60">From </span>}
                        <span className="font-mono font-medium tabular">{phpShort(p.starting_price)}</span>
                        {p.unit && <span className="text-graphite group-hover:text-paper/60"> {p.unit}</span>}
                      </>
                    ) : (
                      <span className="text-foil-dark group-hover:text-foil-light">Priced per job. Ask for a quote</span>
                    )}
                  </p>
                  {orderingEnabled && (
                    <Link
                      href={`/order?product=${p.slug}`}
                      className="mt-4 inline-flex items-center gap-1.5 self-start rounded-md border border-ink/20 px-3 py-1.5 text-sm font-medium group-hover:border-foil group-hover:text-foil-light"
                    >
                      Order {p.name.toLowerCase()} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  )}
                  </div>
                </li>
              ))}
              {/* Fills whatever is left of the last row, so the grid never ends in empty cells */}
              <li className={`flex flex-col justify-between gap-8 bg-ink p-6 text-paper sm:p-8 ${CTA_SPAN_SM[products.length % 2]} ${CTA_SPAN_LG[products.length % 3]}`}>
                <div>
                  <p className="font-mono text-[0.65rem] tracking-widest text-foil uppercase">Custom jobs</p>
                  <h3 className="mt-5 font-display text-3xl font-semibold uppercase">Something else in mind?</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-paper/70">
                    We print more than what&apos;s listed here. Tell us what you need and we&apos;ll quote it.
                  </p>
                </div>
                <a
                  href={SHOP.messengerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 self-start rounded-md bg-foil px-4 py-2.5 text-sm font-medium text-ink hover:bg-foil-light"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  Message us
                </a>
              </li>
            </ul>
          </div>
        </section>

        {/* ── Process ── */}
        <section id="process" className="scroll-mt-8 border-y border-rule bg-paper-2">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
            <p className="font-mono text-xs tracking-[0.3em] text-foil-dark uppercase">How it works</p>
            <h2 className="mt-3 max-w-2xl font-display text-5xl font-bold uppercase sm:text-6xl">
              From message to finished print
            </h2>
            <ol className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative border-t-2 border-ink pt-5">
                  <span className="font-mono text-xs text-foil-dark">Step {i + 1} of {STEPS.length}</span>
                  <h3 className="mt-2 font-display text-2xl font-semibold uppercase">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-graphite">{step.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-10 max-w-2xl border-l-2 border-foil pl-4 text-sm text-graphite">
              <span className="font-medium text-ink">Lead time: {SHOP.leadTime}.</span> Need it sooner?{" "}
              <a href={SHOP.facebookUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                Message us on Facebook
              </a>{" "}
              to check if a rush is possible.
            </p>
          </div>
        </section>

        {/* ── Online ordering (placeholder for future checkout) ── */}
        <section className="bg-paper">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
            <div className="crop-marks flex flex-col gap-6 px-8 py-10 text-graphite sm:flex-row sm:items-center sm:justify-between sm:px-12">
              {orderingEnabled ? (
                <>
                  <div className="text-ink">
                    <p className="font-mono text-xs tracking-[0.3em] text-foil-dark uppercase">Order online</p>
                    <h2 className="mt-2 font-display text-3xl font-bold uppercase sm:text-4xl">Order here, pay by QR</h2>
                    <p className="mt-2 max-w-xl text-graphite">
                      Send your order from this site. We confirm the price, you pay with your banking app and upload the receipt, and you
                      can follow the order from your phone.
                    </p>
                  </div>
                  <Link
                    href="/order"
                    className="inline-flex shrink-0 items-center gap-2 self-start rounded-md bg-ink px-5 py-3 font-medium text-paper hover:bg-ink-3 sm:self-auto"
                  >
                    Start an order
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </>
              ) : (
                <>
                  <div className="text-ink">
                    <p className="font-mono text-xs tracking-[0.3em] text-foil-dark uppercase">Coming soon</p>
                    <h2 className="mt-2 font-display text-3xl font-bold uppercase sm:text-4xl">Order and pay online</h2>
                    <p className="mt-2 max-w-xl text-graphite">
                      Soon you&apos;ll be able to choose a product, upload your artwork and pay right here. Until then, send
                      us a message and we&apos;ll handle your order.
                    </p>
                  </div>
                  <a
                    href={SHOP.messengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-2 self-start rounded-md bg-ink px-5 py-3 font-medium text-paper hover:bg-ink-3 sm:self-auto"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    Order through Messenger
                  </a>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── About ── */}
        <section id="about" className="scroll-mt-8 bg-ink text-paper">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:py-28">
            <p className="font-serif text-[clamp(2.6rem,5.5vw,4.5rem)] leading-[1.02] font-medium">
              Precision.
              <br />
              <span className="italic text-foil-light">Creativity.</span>
              <br />
              Quality.
            </p>
            <div className="self-end text-paper/75">
              <p className="text-lg leading-relaxed">
                Visual Verse Prints is a DTI- and BIR-registered print shop in {SHOP.city}. We print for small
                businesses, events, schools and anyone with something worth putting on paper, from a single sticker
                sheet to hundreds of cup sleeves.
              </p>
              <a
                href={SHOP.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 text-foil-light hover:text-foil"
              >
                <ExternalLink className="size-4" aria-hidden />
                See our latest work on Facebook
                <ArrowRight className="size-4" aria-hidden />
              </a>
            </div>
          </div>
        </section>

        {/* ── Contact ── */}
        <section id="contact" className="scroll-mt-8 bg-foil text-ink">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-20">
            <div>
              <p className="font-mono text-xs tracking-[0.3em] text-ink/70 uppercase">Contact us</p>
              <h2 className="mt-3 font-display text-5xl font-bold uppercase sm:text-6xl">Tell us what you need printed</h2>
              <p className="mt-3 max-w-md text-ink/80">Call, text, email or message us. We&apos;ll reply with a quote.</p>

              <p className="mt-10 font-mono text-xs tracking-[0.3em] text-ink/70 uppercase">Follow our work</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {SOCIALS.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${s.name}: ${s.handle}`}
                      className="inline-flex items-center gap-2.5 rounded-full border border-ink/30 py-1.5 pr-4 pl-1.5 text-sm font-medium transition-colors hover:bg-ink hover:text-foil-light"
                    >
                      <span className="grid size-8 place-items-center rounded-full bg-ink text-foil-light">
                        <s.icon className="size-4" />
                      </span>
                      {s.handle}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <ul className="divide-y divide-ink/20 border-y border-ink/20">
              <li>
                <a href={SHOP.phoneHref} className="group flex items-center gap-4 py-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-foil-light">
                    <Phone className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[0.68rem] tracking-widest text-ink/70 uppercase">Call or text</span>
                    <span className="block font-display text-3xl font-semibold tracking-wide group-hover:underline">{SHOP.phone}</span>
                  </span>
                </a>
              </li>
              <li>
                <a href={`mailto:${SHOP.email}`} className="group flex items-center gap-4 py-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-foil-light">
                    <Mail className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[0.68rem] tracking-widest text-ink/70 uppercase">Email</span>
                    <span className="block text-[0.95rem] font-medium break-words group-hover:underline sm:text-xl">
                      {SHOP.email.split("@")[0]}
                      <wbr />@{SHOP.email.split("@")[1]}
                    </span>
                  </span>
                </a>
              </li>
              <li>
                <a href={SHOP.messengerUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 py-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-foil-light">
                    <MessageCircle className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[0.68rem] tracking-widest text-ink/70 uppercase">Messenger</span>
                    <span className="block text-lg font-medium group-hover:underline sm:text-xl">Message Visual Verse Prints</span>
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-paper/10 bg-ink text-paper/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3 text-foil-light">
            <LogoMark className="size-7" />
            <span>
              © {new Date().getFullYear()} {SHOP.name} · {SHOP.city}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href={SHOP.phoneHref} className="hover:text-paper">
              {SHOP.phone}
            </a>
            <a href={`mailto:${SHOP.email}`} className="break-all hover:text-paper">
              {SHOP.email}
            </a>
            <a href={SHOP.messengerUrl} target="_blank" rel="noopener noreferrer" className="hover:text-paper">
              Messenger
            </a>
            <Link href="/login" className="hover:text-paper">
              Staff sign in
            </Link>
            <span className="flex items-center gap-1">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.name}: ${s.handle}`}
                  title={s.name}
                  className="grid size-8 place-items-center rounded-full text-paper/70 hover:bg-paper/10 hover:text-foil-light"
                >
                  <s.icon className="size-4" />
                </a>
              ))}
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
