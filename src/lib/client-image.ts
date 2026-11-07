/**
 * Browser-side image preparation: phone photos are often 5–12 MB, so we
 * downscale to ≤ maxSide px and re-encode as JPEG before uploading.
 * Falls back to the original file if the browser cannot decode it
 * (the server still validates type and size).
 */
export async function downscaleImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  const small = file.size <= 1.5 * 1024 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type);
  if (small || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
