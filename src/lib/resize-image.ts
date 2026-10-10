/** Image types accepted for uploads (photos and screenshots). */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/**
 * Shrink a photo in the browser before upload so phone pictures and screenshots (often 5–10 MB) upload as a few
 * hundred KB. Browser-only.
 */
export async function resizeImage(file: File, maxEdge = 1600): Promise<{ blob: Blob; ext: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("This image couldn't be processed.");
  return { blob: jpeg, ext: "jpg" };
}
