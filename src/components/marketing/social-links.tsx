import type { ReactNode, SVGProps } from "react";
import { SHOP } from "@/lib/catalog";

// Brand glyphs drawn as simple line icons (the icon library no longer ships brand logos)
const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

export function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

export const SOCIALS: { name: string; handle: string; href: string; icon: (props: SVGProps<SVGSVGElement>) => ReactNode }[] = [
  { name: "Facebook", handle: "Visual Verse Prints", href: SHOP.facebookUrl, icon: FacebookIcon },
  { name: "Instagram", handle: "@visualverseprints", href: SHOP.instagramUrl, icon: InstagramIcon },
  { name: "TikTok", handle: "@visualverseprints_", href: SHOP.tiktokUrl, icon: TikTokIcon },
];
