import { mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Uploaded images live on the persistent volume in production (mounted at
// /data) so they survive redeploys, alongside the sqlite database. In dev they
// go in server/uploads/. Served back out by the GET /uploads/:name route.
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR ??
  (process.env.NODE_ENV === 'production' ? '/data/uploads' : './uploads');

mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6 MB after decode

// Writes a base64-encoded image to the upload dir and returns its public path.
// Throws on unsupported type, empty data, or oversize.
export async function saveImage(base64: string, contentType: string): Promise<string> {
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) throw new Error('Unsupported image type - use JPEG, PNG or WebP');

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) throw new Error('Empty image');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('Image too large (max 6 MB)');

  // randomUUID → hex + hyphens only, so the filename is always traversal-safe.
  const name = `${randomUUID()}.${ext}`;
  await writeFile(join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
}

const SAFE_NAME = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/;

// Deletes a file previously returned by saveImage, given its public path
// ("/uploads/x.jpg"). No-op for empty values, external URLs, or unsafe names,
// and swallows a missing-file error — used to reclaim replaced/deleted covers.
export async function unlinkImage(path: string | null | undefined): Promise<void> {
  if (!path?.startsWith('/uploads/')) return;
  const name = path.slice('/uploads/'.length);
  if (!SAFE_NAME.test(name)) return;
  await unlink(join(UPLOAD_DIR, name)).catch(() => {});
}
