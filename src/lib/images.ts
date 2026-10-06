/** Catalog photos live in a public Supabase Storage bucket; only those URLs are shown on the site. */
export const PRODUCT_BUCKET = "product-images";
/** Photos per product (showcase of finished work; the first is the cover). */
export const MAX_PRODUCT_IMAGES = 12;

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

/** Only the photos that are real files in our bucket, in order. */
export function hostedProductImages(urls: readonly (string | null | undefined)[] | null | undefined): string[] {
  return (urls ?? []).filter(isHostedProductImage);
}

/**
 * A product's photos in display order. Falls back to a lone cover photo (image_url) when the gallery list is empty,
 * so a photo saved before galleries existed still shows.
 */
export function productPhotos(product: { image_urls?: readonly string[] | null; image_url?: string | null }): string[] {
  const gallery = hostedProductImages(product.image_urls);
  if (gallery.length) return gallery;
  return isHostedProductImage(product.image_url) ? [product.image_url] : [];
}
