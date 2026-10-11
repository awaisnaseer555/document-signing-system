/** Local / long-running hosts */
export const LOCAL_MAX_PDF_BYTES = 25 * 1024 * 1024;

/**
 * Vercel Functions typically reject request bodies around ~4.5MB.
 * Cap slightly under that so multer/validation fail with a clear API error.
 */
export const VERCEL_MAX_PDF_BYTES = 4 * 1024 * 1024;

export function getMaxPdfBytes(): number {
  return process.env.VERCEL === '1' ? VERCEL_MAX_PDF_BYTES : LOCAL_MAX_PDF_BYTES;
}

export function getMaxPdfLabel(): string {
  const bytes = getMaxPdfBytes();
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}
