"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

/**
 * Showcase of a product's finished work on its service card: swipe (or use the arrows) to move between photos,
 * tap a photo to open it full screen.
 */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const animating = useRef(false);
  const animationTimer = useRef<number | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const many = images.length > 1;

  const scrollTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(images.length - 1, i));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Update right away, and ignore the in-between positions of the animated scroll so the counter doesn't flicker
    setIndex(clamped);
    animating.current = true;
    window.clearTimeout(animationTimer.current);
    const left = clamped * track.clientWidth;
    animationTimer.current = window.setTimeout(() => {
      animating.current = false;
      // If the smooth scroll didn't finish (some browsers pause it), land on the photo anyway
      if (Math.abs(track.scrollLeft - left) > 2) track.scrollTo({ left, behavior: "instant" });
    }, 700);
    track.scrollTo({ left, behavior: reduceMotion ? "instant" : "smooth" });
  };

  // Swipes and trackpad scrolls
  const onScroll = () => {
    const track = trackRef.current;
    if (animating.current || !track || track.clientWidth === 0) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  const open = (i: number) => {
    setViewer(i);
    dialogRef.current?.showModal();
  };
  const close = () => {
    dialogRef.current?.close();
    setViewer(null);
  };
  const step = useCallback((by: number) => setViewer((v) => (v === null ? v : (v + by + images.length) % images.length)), [images.length]);

  // Arrow keys move through photos while the viewer is open (Esc closes natively)
  useEffect(() => {
    if (viewer === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, step]);

  return (
    <div className="relative aspect-[4/3] bg-paper-2" role="group" aria-roledescription="carousel" aria-label={`${name} photos`}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => open(i)}
            className="relative size-full shrink-0 snap-center cursor-zoom-in focus-visible:outline-offset-[-3px]"
            aria-label={`View ${name} photo ${i + 1} of ${images.length} full screen`}
          >
            <Image
              src={src}
              alt={`${name}, finished work ${i + 1}`}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      <span className="pointer-events-none absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-ink/60 text-paper">
        <Expand className="size-3.5" aria-hidden />
      </span>

      {many && (
        <>
          <button
            type="button"
            onClick={() => scrollTo(index - 1)}
            disabled={index === 0}
            className="absolute top-1/2 left-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-ink/70 text-paper hover:bg-ink disabled:opacity-0"
            aria-label="Previous photo"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollTo(index + 1)}
            disabled={index === images.length - 1}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-ink/70 text-paper hover:bg-ink disabled:opacity-0"
            aria-label="Next photo"
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-2 py-0.5 font-mono text-[0.65rem] text-paper">
            {index + 1} / {images.length}
          </span>
        </>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setViewer(null)}
        onCancel={() => setViewer(null)}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-0 size-full max-h-none max-w-none bg-ink/95 p-0 text-paper backdrop:bg-ink/80"
        aria-label={`${name} photos`}
      >
        {viewer !== null && (
          <div className="relative flex size-full flex-col">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="font-display text-xl font-semibold tracking-wide uppercase">
                {name}
                <span className="ml-3 font-mono text-xs font-normal tracking-normal text-paper/60 normal-case">
                  {viewer + 1} of {images.length}
                </span>
              </p>
              <button type="button" onClick={close} className="grid size-9 place-items-center rounded-full hover:bg-paper/10" aria-label="Close photos">
                <X className="size-5" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1" onClick={(e) => e.target === e.currentTarget && close()}>
              <Image
                key={images[viewer]}
                src={images[viewer]}
                alt={`${name}, finished work ${viewer + 1}`}
                fill
                sizes="100vw"
                className="object-contain p-2 sm:p-6"
              />
              {many && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    className="absolute top-1/2 left-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-paper/10 hover:bg-paper/20 sm:left-4"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-paper/10 hover:bg-paper/20 sm:right-4"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}
            </div>
            {many && (
              <ul className="flex gap-2 overflow-x-auto px-4 py-3">
                {images.map((src, i) => (
                  <li key={src} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewer(i)}
                      aria-label={`Show photo ${i + 1}`}
                      aria-current={i === viewer}
                      className={`relative block h-14 w-20 overflow-hidden rounded ${i === viewer ? "ring-2 ring-foil" : "opacity-60 hover:opacity-100"}`}
                    >
                      <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}
