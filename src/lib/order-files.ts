/** Design files customers can attach to an order. Shared by the browser form and the server checks. */

export const ORDER_FILE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  ai: "application/postscript",
  eps: "application/postscript",
  psd: "image/vnd.adobe.photoshop",
  zip: "application/zip",
};

export const ORDER_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const ORDER_FILES_PER_ORDER = 10;
export const ORDER_FILE_ACCEPT = Object.keys(ORDER_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");
export const ORDER_FILE_HINT = "JPG, PNG, PDF, AI, EPS, PSD or ZIP, up to 20 MB each";

export function fileExtension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
