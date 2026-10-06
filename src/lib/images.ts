/** Catalog photos live in a public Supabase Storage bucket; only those URLs are shown on the site. */
export const PRODUCT_BUCKET = "product-images";

export function productImagePrefix() {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_BUCKET}/`;
}

/** True when the URL is a file in our product-images bucket (not a pasted link from elsewhere). */
export function isHostedProductImage(url: string | null | undefined): url is string {
  return !!url && !!process.env.NEXT_PUBLIC_SUPABASE_URL && url.startsWith(productImagePrefix());
}

/** Storage object path for a hosted image URL, or null. */
export function productImagePath(url: string | null | undefined) {
  return isHostedProductImage(url) ? decodeURIComponent(url.slice(productImagePrefix().length).split("?")[0]) : null;
}
