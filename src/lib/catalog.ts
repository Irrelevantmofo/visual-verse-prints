import { createClient } from "@supabase/supabase-js";
import type { Product } from "@/types/db";

/** Fallback catalog (mirrors the seed in supabase/migrations) so the landing page renders without a database. */
const FALLBACK: Omit<Product, "id">[] = [
  { name: "Stickers", slug: "stickers", category: "Labels & Stickers", description: "Die-cut, kiss-cut, transparent and laminated sticker sheets in matte or glossy.", starting_price: 80, fixed_price: false, unit: "per sheet", commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 10 },
  { name: "Business Cards", slug: "business-cards", category: "Stationery", description: "Laminated calling cards on premium stock, printed sharp and cut clean.", starting_price: 5, fixed_price: false, unit: "per card", commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 20 },
  { name: "Flyers", slug: "flyers", category: "Marketing", description: "Full-color flyers and leaflets for promos, menus and events.", starting_price: null, fixed_price: false, unit: null, commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 30 },
  { name: "Invitations", slug: "invitations", category: "Events", description: "Wedding, birthday and corporate invitations with elegant finishes.", starting_price: null, fixed_price: false, unit: null, commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 40 },
  { name: "Book Binding", slug: "book-binding", category: "Binding", description: "Thesis, manuals, brand books and photo books — bound to last.", starting_price: null, fixed_price: false, unit: null, commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 50 },
  { name: "Calendars", slug: "calendars", category: "Stationery", description: "Desk and wall calendars customized with your brand or photos.", starting_price: null, fixed_price: false, unit: null, commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 60 },
  { name: "Cup Sleeves", slug: "cup-sleeves", category: "Packaging", description: "Branded cup sleeves for cafés and events.", starting_price: 13, fixed_price: false, unit: "per piece", commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 70 },
  { name: "Pads", slug: "pads", category: "Stationery", description: "Notepads, order pads and receipt pads with your logo.", starting_price: null, fixed_price: false, unit: null, commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 80 },
  { name: "Labels", slug: "labels", category: "Labels & Stickers", description: "Product labels for bottles, jars and packaging.", starting_price: null, fixed_price: false, unit: null, commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 90 },
  { name: "Packaging", slug: "packaging", category: "Packaging", description: "Custom boxes and sleeves that make unboxing memorable.", starting_price: null, fixed_price: false, unit: null, commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 100 },
  { name: "Customized Tumblers", slug: "customized-tumblers", category: "Merch", description: "Personalized 500ml tumblers for giveaways and gifts.", starting_price: 210, fixed_price: false, unit: "per piece", commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 110 },
  { name: "Print & Laminate", slug: "print-and-laminate", category: "Print", description: "Document printing with lamination while you wait.", starting_price: null, fixed_price: false, unit: null, commission_rate: null, image_url: null, image_urls: [], active: true, sort_order: 120 },
];

export async function getCatalog(): Promise<Product[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const fallback = FALLBACK.map((p) => ({ ...p, id: p.slug }));
  if (!url || !key) return fallback;
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("products")
      // anon may read display columns only (commission_rate is staff-only)
      .select("id, name, slug, category, description, starting_price, fixed_price, unit, image_url, image_urls, active, sort_order")
      .eq("active", true)
      .order("sort_order");
    if (error || !data?.length) return fallback;
    return data.map((p) => ({ ...p, commission_rate: null })) as Product[];
  } catch {
    return fallback;
  }
}

export const SHOP = {
  name: "Visual Verse Prints",
  city: "Caloocan City",
  facebookUrl: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? "https://www.facebook.com/profile.php?id=61573844768004",
  messengerUrl: process.env.NEXT_PUBLIC_MESSENGER_URL ?? "https://m.me/61573844768004",
  instagramUrl: "https://www.instagram.com/visualverseprints/",
  tiktokUrl: "https://www.tiktok.com/@visualverseprints_",
  phone: "0946 074 9319",
  phoneHref: "tel:+639460749319",
  email: "visualverseprintingstudio@gmail.com",
  /** What customers search for as the pick-up point when booking their own Lalamove. */
  pickupName: "Visual Verse Printing Services Caloocan",
  leadTime: "5–14 days, including weekends",
};
