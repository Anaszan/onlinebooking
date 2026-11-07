/**
 * Image upload validation. The browser-supplied MIME type and filename are
 * NOT trusted — the real type is detected from the file's magic bytes.
 */

export const MAX_PET_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_SHOP_IMAGE_BYTES = 3 * 1024 * 1024;

export type ImageKind = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

export class ImageValidationError extends Error {}

/** Validate an uploaded File; returns bytes + detected type. */
export async function readImage(file: File, maxBytes: number) {
  if (file.size === 0) throw new ImageValidationError("ไฟล์รูปว่างเปล่า");
  if (file.size > maxBytes) {
    throw new ImageValidationError(`รูปใหญ่เกินไป (สูงสุด ${Math.round(maxBytes / 1024 / 1024)} MB)`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw new ImageValidationError("รองรับเฉพาะไฟล์รูป JPG, PNG หรือ WEBP");
  return { bytes, ...kind };
}
