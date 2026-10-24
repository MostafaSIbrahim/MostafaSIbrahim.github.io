/** Client-side media handling for the admin page: resize + WebP, size and type checks. */

export const LIMITS = {
  imageInputMB: 15, // what we accept before conversion
  maxImageWidth: 1600, // px after conversion
  videoMB: 25, // GitHub's API handles this comfortably; keep previews short
};

export interface PreparedImage {
  blob: Blob;
  ext: 'webp' | 'png' | 'jpg';
  width: number;
  height: number;
}

/** Downscale to 1600 px wide and encode as WebP (falls back to the original if WebP isn't supported). */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`);
  if (file.size > LIMITS.imageInputMB * 1024 * 1024) {
    throw new Error(`${file.name} is larger than ${LIMITS.imageInputMB} MB.`);
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LIMITS.maxImageWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.82),
  );
  if (blob && blob.type === 'image/webp') return { blob, ext: 'webp', width, height };
  // Browser without WebP encoding: keep the original file untouched.
  return { blob: file, ext: file.type === 'image/png' ? 'png' : 'jpg', width, height };
}

export function checkVideo(file: File, kind: 'mp4' | 'webm'): string | null {
  const type = kind === 'mp4' ? 'video/mp4' : 'video/webm';
  if (file.type !== type) return `Choose a .${kind} file.`;
  if (file.size > LIMITS.videoMB * 1024 * 1024) {
    return `${file.name} is ${(file.size / 1048576).toFixed(1)} MB; keep previews under ${LIMITS.videoMB} MB.`;
  }
  return null;
}

/** "SafyaClinic 2.0!" -> "safyaclinic-2-0" */
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

/** Short unique suffix so replaced files get new URLs (no stale browser caches). */
export const stamp = (): string => Date.now().toString(36);
