import { onSnapshot, query, where, orderBy, limit, updateDoc, writeBatch, setDoc, type WriteBatch, type Transaction } from 'firebase/firestore';
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
export const markRead = (id: string, read = true) => updateDoc(ref(C.notifications, id), { read, ...touch() });
export async function markAllRead(unreadIds: string[]) {
  for (const part of chunk(unreadIds, LIMITS.batchMaxWrites)) {
    const b = writeBatch(db); part.forEach((id) => b.update(ref(C.notifications, id), { read: true, ...touch() })); await b.commit();
  }
}
export const softDeleteNotification = (id: string, actorId: string) => updateDoc(ref(C.notifications, id), softDeletePayload(actorId));
export const restoreNotification = (id: string) => updateDoc(ref(C.notifications, id), restorePayload());

/** Bildirim belge kimliği: `${type}_${refId}_${userId}`; tekrar edebilen türlerde refId olay damgası taşır (W-49). */
const REPEATABLE = new Set(['application_received', 'application_approved', 'application_rejected', 'removed_from_club', 'role_changed', 'waitlist_promoted', 'report_resolved']);
function refIdOf(type: string, refs: NotificationRefs): string {
  const base = type === 'announcement' ? refs.postId
    : ['event_new', 'event_reminder', 'event_cancelled', 'waitlist_promoted'].includes(type) ? refs.eventId
    : type === 'application_received' ? `${refs.clubId}-${refs.applicantId}`
    : type === 'report_resolved' || type === 'new_report' ? refs.reportId
    : type === 'system' ? refs.textKey : refs.clubId;
  return REPEATABLE.has(type) ? `${base}-${Date.now().toString(36)}` : String(base);
}
export interface NotificationDraft { type: string; refs: NotificationRefs }
const payload = (d: NotificationDraft, userId: string) => ({ userId, type: d.type, refs: d.refs, read: false, ...baseCreate() });
/** NotificationRepository.addToBatch — tek alıcı, kritik batch/transaction içinde. */
export function addNotification(w: WriteBatch | Transaction, d: NotificationDraft, recipientId: string) {
  (w as WriteBatch).set(ref(C.notifications, ids.notification(d.type, refIdOf(d.type, d.refs), recipientId)), payload(d, recipientId));
}
/** ClientFanOutDispatcher: parçalı (50) batch, aborted/unavailable için geri çekilmeli yeniden deneme. Hata kullanıcıya gösterilmez. */
export async function fanOut(d: NotificationDraft, recipients: string[], excludeUserId?: string): Promise<{ requested: number; written: number; failedChunks: number }> {
  const list = uniq(recipients).filter((u) => u && u !== excludeUserId);
  let written = 0; let failedChunks = 0;
  const refId = refIdOf(d.type, d.refs);
  for (const part of chunk(list, LIMITS.notificationFanOutChunkSize)) {
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
/** CD-44: cihaz kendi event_reminder belgesini yazar (idempotent kimlik). */
export async function createSelfReminder(uid: string, eventId: string, clubId: string) {
  try {
    await setDoc(ref(C.notifications, ids.notification('event_reminder', eventId, uid)), payload({ type: 'event_reminder', refs: { eventId, clubId } }, uid));
  } catch { /* zaten var ya da izin yok: best-effort */ }
}
