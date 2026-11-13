/** Downscale large photos client-side (keeps the original aspect ratio, never crops). */
export async function preparePhoto(
  file: File,
  maxDim = 2400,
): Promise<{ blob: Blob; width: number; height: number; ext: string; type: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) throw new Error('Could not read this image. Please use JPG, PNG or WebP.');
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode image'))), 'image/jpeg', 0.9),
  );
  return { blob, width: w, height: h, ext: 'jpg', type: 'image/jpeg' };
}

export function fileExt(file: File, fallback = 'mp4') {
  const m = file.name.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] ?? fallback).toLowerCase();
}
