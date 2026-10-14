import { onSnapshot, query, where, orderBy, limit, updateDoc, writeBatch, setDoc, getDoc, type WriteBatch, type Transaction } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, ids } from '../db';
import { fromQuery, baseCreate, softDeletePayload, restorePayload, touch } from '../fs';
import type { AppNotification, NotificationRefs } from '../models';
import { LIMITS } from '../../lib/constants';
import { chunk, sleep, uniq } from '../../lib/util';

export function watchInbox(uid: string, cb: (items: AppNotification[]) => void, onErr?: (e: unknown) => void) {
  return onSnapshot(
    query(col(C.notifications), where('userId', '==', uid), where('isDeleted', '==', false), orderBy('createdAt', 'desc'), limit(LIMITS.notificationInboxLimit)),
    (qs) => cb(fromQuery<AppNotification>(qs)), (e) => { console.warn('bildirim akışı', e); onErr?.(e); },
  );
}
/** Okundu: yalnızca `read: true` (+ updatedAt). Okunmamışa dönüş kuralda yoktur. */
export const markRead = (id: string) => updateDoc(ref(C.notifications, id), { read: true, ...touch() });
export async function markAllRead(unreadIds: string[]) {
  for (const part of chunk(unreadIds, LIMITS.batchMaxWrites)) {
    const b = writeBatch(db); part.forEach((id) => b.update(ref(C.notifications, id), { read: true, ...touch() })); await b.commit();
  }
}
export const softDeleteNotification = (id: string, actorId: string) => updateDoc(ref(C.notifications, id), softDeletePayload(actorId));
export const restoreNotification = (id: string) => updateDoc(ref(C.notifications, id), restorePayload());

/** NotificationWriter.newEventKey — olay başına 20 karakterlik rastgele anahtar ([A-Za-z0-9]). */
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function newEventKey() {
  const buf = new Uint32Array(20); crypto.getRandomValues(buf);
  return Array.from(buf, (x) => KEY_ALPHABET[x % KEY_ALPHABET.length]).join('');
}
/**
 * Olay anahtarı (W-49, CD-148): tek seferlik olaylarda olayın kimliği (duyuru → postId, iptal → eventId,
 * başvuru → {clubId}_{applicantId}_{priorCount}, hatırlatıcı → eventId); diğerlerinde olay başına rastgele.
 */
export function eventKeyOf(type: string, refs: NotificationRefs, extra?: { priorCount?: number }): string {
  if (type === 'announcement') return String(refs.postId);
  if (type === 'event_cancelled' || type === 'event_reminder') return String(refs.eventId);
  if (type === 'application_received') return `${refs.clubId}_${refs.applicantId}_${extra?.priorCount ?? 0}`;
  return newEventKey();
}
export interface NotificationDraft { type: string; refs: NotificationRefs }
/** Yalnızca tanımlı refs anahtarları yazılır (W-51: null alanın anahtarı yok). */
const cleanRefs = (refs: NotificationRefs) => Object.fromEntries(Object.entries(refs).filter(([, v]) => v != null && v !== ''));
const payload = (d: NotificationDraft, userId: string) => ({ userId, type: d.type, refs: cleanRefs(d.refs), read: false, ...baseCreate() });
/** NotificationRepository.addToBatch — tek alıcı, kritik batch/transaction içinde. */
export function addNotification(w: WriteBatch | Transaction, d: NotificationDraft, recipientId: string, key: string = eventKeyOf(d.type, d.refs)) {
  (w as WriteBatch).set(ref(C.notifications, ids.notification(d.type, key, recipientId)), payload(d, recipientId));
}
/** ClientFanOutDispatcher: parçalı (50) batch, aborted/unavailable için geri çekilmeli yeniden deneme. Hata kullanıcıya gösterilmez. */
export async function fanOut(d: NotificationDraft, recipients: string[], excludeUserId?: string, opts: { key?: string; chunkSize?: number } = {}): Promise<{ requested: number; written: number; failedChunks: number }> {
  const list = uniq(recipients).filter((u) => u && u !== excludeUserId);
  let written = 0; let failedChunks = 0;
  const refId = opts.key ?? eventKeyOf(d.type, d.refs);
  for (const part of chunk(list, opts.chunkSize ?? LIMITS.notificationFanOutChunkSize)) {
    let ok = false;
    for (const wait of [0, 250, 500, 1000]) {
      if (wait) await sleep(wait);
      try {
        const b = writeBatch(db);
        part.forEach((u) => b.set(ref(C.notifications, ids.notification(d.type, refId, u)), payload(d, u)));
        await b.commit(); ok = true; break;
      } catch (e) {
        const code = (e as { code?: string }).code || '';
        if (!/aborted|unavailable/.test(code)) break;
      }
    }
    if (ok) written += part.length; else failedChunks++;
  }
  if (failedChunks) console.warn(`[fan-out] ${d.type}: ${failedChunks} parça yazılamadı`);
  return { requested: list.length, written, failedChunks };
}
/** CD-44: cihaz kendi event_reminder belgesini yazar; önce okur, belge varsa (silinmiş olsa da) yazmaz. */
export async function createSelfReminder(uid: string, eventId: string, clubId: string) {
  try {
    const r = ref(C.notifications, ids.notification('event_reminder', eventId, uid));
    if ((await getDoc(r)).exists()) return;
    await setDoc(r, payload({ type: 'event_reminder', refs: { clubId, eventId } }, uid));
  } catch { /* izin yok: best-effort */ }
}
