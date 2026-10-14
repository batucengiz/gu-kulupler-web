/* StorageService + StoragePaths — istemcide sıkıştırma (≤1600 px, JPEG 0.82), < 5 MB, üzerine yazma yok. */
import { ref as sref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../../lib/firebase';
import { AppError } from '../fs';
import { LIMITS } from '../../lib/constants';
import { newFileName } from '../../lib/util';

export const StoragePaths = {
  avatar: (uid: string) => `users/${uid}/${newFileName('jpg')}`,
  club: (clubId: string) => `clubs/${clubId}/${newFileName('jpg')}`,
  eventCover: (eventId: string) => `events/${eventId}/${newFileName('jpg')}`,
  postImage: (postId: string) => `posts/${postId}/${newFileName('jpg')}`,
  support: (ticketNo: string) => `support/${ticketNo}/${newFileName('jpg')}`,
};
export interface Prepared { blob: Blob; w: number; h: number }

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new AppError('invalidType')); };
    img.src = url;
  });
}
/** Görseli doğrula + sıkıştır. Hata kodları: invalidType, sizeLimit. */
export async function prepareImage(file: File | Blob, maxSide = 1600): Promise<Prepared> {
  if (!file.type || !file.type.startsWith('image/')) throw new AppError('invalidType');
  if (file.size > 20 * 1024 * 1024) throw new AppError('sizeLimit');
  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)); const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
  let q = 0.82; let blob: Blob | null = null;
  for (let i = 0; i < 4; i++) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size < LIMITS.imageMaxBytes) break;
    q -= 0.15;
  }
  if (!blob || blob.size >= LIMITS.imageMaxBytes) throw new AppError('sizeLimit');
  return { blob, w, h };
}
/**
 * Yükleme (üzerine yazma yok). Özel üst veri yola göre (Storage kuralları): `users/` hiç taşımaz;
 * `posts/`, `events/`, `clubs/` `{clubId, uploaderId}`, `support/` `{uploaderId}` — `uploaderId` oturumdaki uid'dir.
 */
export async function upload(path: string, p: Prepared, metadata?: { clubId?: string }): Promise<string> {
  const uploaderId = auth.currentUser?.uid;
  const customMetadata: Record<string, string> | undefined = path.startsWith('users/') ? undefined
    : path.startsWith('support/') ? { uploaderId: uploaderId! }
    : { clubId: metadata?.clubId || '', uploaderId: uploaderId! };
  await uploadBytes(sref(storage, path), p.blob, { contentType: 'image/jpeg', ...(customMetadata ? { customMetadata } : {}) });
  return path;
}
const urlCache = new Map<string, Promise<string>>();
export function urlOf(path: string): Promise<string> {
  let p = urlCache.get(path);
  if (!p) { p = getDownloadURL(sref(storage, path)); urlCache.set(path, p); p.catch(() => urlCache.delete(path)); }
  return p;
}
