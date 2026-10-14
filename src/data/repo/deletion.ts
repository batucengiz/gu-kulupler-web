/* AccountDeletionRepository — sıra sabit, her adım idempotent (T-29). Gönderi/yorum kalır, Auth kimliği silinmez. */
import { getDoc, getDocs, query, where, writeBatch, runTransaction, increment, limit, type DocumentReference } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, ids, accountRef, contactRef } from '../db';
import { fromDoc, fromQuery, softDeletePayload, touch, errCode } from '../fs';
import type { ClubEvent, Membership, Rsvp } from '../models';
import { listMine } from './memberships';
import { listMyRsvps } from './rsvps';
import { LIMITS } from '../../lib/constants';
import { chunk } from '../../lib/util';

export const DELETED_NAME = 'Silinmiş kullanıcı';
export async function precheck(uid: string): Promise<{ blockedBy: string[] }> {
  const mine = await listMine(uid);
  return { blockedBy: mine.filter((m) => m.status === 'active' && m.role === 'president').map((m) => m.clubId) };
}
/** Adım 1 — tek batch: profil anonim + status deleted + soft delete; hesap e-postası ve FCM jetonları boşalır. Zaten silinmişse yazım yok (yeniden başlatma). */
export async function markDeleted(uid: string) {
  const u = await getDoc(ref(C.users, uid));
  if (u.exists() && u.data().status === 'deleted') return;
  const b = writeBatch(db);
  b.update(ref(C.users, uid), { name: DELETED_NAME, nameLower: 'silinmiş kullanıcı', bio: '', interests: [], avatarPath: null, department: null, year: null, status: 'deleted', ...softDeletePayload(uid) });
  b.update(accountRef(uid), { email: '', emailLower: '', fcmTokens: [], ...touch() });
  await b.commit();
}
/** Anonimleştirme.applicantPayload */
const ANON_APPLICANT = { name: DELETED_NAME, department: null, year: null, avatarSeed: 'deleted' };
const isAnonApplicant = (a: Membership['applicant'] | undefined) => !!a && a.name === DELETED_NAME && a.department == null && a.year == null && a.avatarSeed === 'deleted';
/** M14 — tek transaction (≤ accountDeletionChunk): her üyelik + contact okunur; idempotent. */
async function anonymizeMembershipChunk(uid: string, list: Membership[]) {
  await runTransaction(db, async (tx) => {
    const cur: Array<{ m: Membership; contact: Record<string, unknown> | null }> = [];
    for (const x of list) {
      const m = fromDoc<Membership>(await tx.get(ref(C.memberships, ids.membership(x.clubId, uid))));
      if (!m || m.userId !== uid || m.clubId !== x.clubId) continue;
      const c = await tx.get(contactRef(ids.membership(x.clubId, uid)));
      cur.push({ m, contact: c.exists() ? c.data() : null });
    }
    for (const { m, contact } of cur) {
      const mid = ids.membership(m.clubId, uid);
      // etkin başkan left olamaz (önce devir): durum aynı kalır, yalnızca kişisel veri boşalır
      const next = m.status === 'active' ? (m.role === 'president' ? 'active' : 'left') : m.status === 'pending' ? 'cancelled' : m.status;
      if (next !== m.status || !isAnonApplicant(m.applicant)) tx.update(ref(C.memberships, mid), { ...(next !== m.status ? { status: next } : {}), applicant: ANON_APPLICANT, ...touch() });
      // danışman memberCount'a sayılmaz; başkan ayrılmaz
      if (m.status === 'active' && (m.role === 'member' || m.role === 'board')) tx.update(ref(C.clubs, m.clubId), { memberCount: increment(-1), ...touch() });
      if (contact && !(contact.email === '' && contact.emailLower === '' && contact.note === '')) tx.update(contactRef(mid), { email: '', emailLower: '', note: '', ...touch() });
    }
  });
}
/** Açık kayıtlar — tek transaction: kayıt + etkinlik okunur; bitmemiş etkinlikte going/waitlist → cancelled + sayaç −1. */
async function cancelRsvpChunk(uid: string, list: Rsvp[]) {
  try {
    await runTransaction(db, async (tx) => {
      const cur: Array<{ r: Rsvp; e: ClubEvent | null }> = [];
      for (const x of list) {
        const r = fromDoc<Rsvp>(await tx.get(ref(C.rsvps, ids.rsvp(x.eventId, uid))));
        if (!r || (r.status !== 'going' && r.status !== 'waitlist')) continue;
        const e = fromDoc<ClubEvent>(await tx.get(ref(C.events, x.eventId)));
        cur.push({ r, e });
      }
      for (const { r, e } of cur) {
        if (e && e.endsAt <= Date.now() + LIMITS.clockSkewToleranceMs) continue; // bitmiş etkinliğin kaydı korunur
        tx.update(ref(C.rsvps, ids.rsvp(r.eventId, uid)), { status: 'cancelled', ...touch() });
        tx.update(ref(C.events, r.eventId), { [r.status === 'going' ? 'goingCount' : 'waitlistCount']: increment(-1), ...touch() });
      }
    });
  } catch (e) {
    // etkinliği okunamayan kayıt (ayrılınan kulübün üyelere özel etkinliği): okumadan, tek tek vazgeç
    if (errCode(e) !== 'permission-denied') throw e;
    for (const r of list) {
      const b = writeBatch(db);
      b.update(ref(C.rsvps, ids.rsvp(r.eventId, uid)), { status: 'cancelled', ...touch() });
      b.update(ref(C.events, r.eventId), { [r.status === 'going' ? 'goingCount' : 'waitlistCount']: increment(-1), ...touch() });
      await b.commit().catch(() => undefined); // bitmiş etkinlikte kural reddeder: kayıt korunur
    }
  }
}
async function softDeletePersonal(uid: string) {
  const refs: DocumentReference[] = [];
  const add = async (name: string, field: string) => {
    const qs = await getDocs(query(col(name), where(field, '==', uid), where('isDeleted', '==', false), limit(LIMITS.batchMaxWrites)));
    qs.docs.forEach((d) => refs.push(d.ref));
  };
  await add(C.notifications, 'userId'); await add(C.savedPosts, 'userId'); await add(C.blocks, 'blockerId');
  for (const part of chunk(refs, LIMITS.batchMaxWrites)) { const b = writeBatch(db); part.forEach((r) => b.update(r, softDeletePayload(uid))); await b.commit(); }
}
/** 2 → son adımlar (kayıtlar → üyelikler → kişisel belgeler). Kesintide `users.status == 'deleted'` ile tekrar çağrılır. */
export async function resumeCleanup(uid: string, onProgress?: (step: string) => void) {
  onProgress?.('rsvps');
  const rsvps = (await listMyRsvps(uid)).filter((r) => r.status === 'going' || r.status === 'waitlist');
  for (const part of chunk(rsvps, LIMITS.accountDeletionChunk)) await cancelRsvpChunk(uid, part);
  onProgress?.('memberships');
  const mine = (await listMine(uid)).filter((m) => !isAnonApplicant(m.applicant) || m.status === 'active' || m.status === 'pending');
  for (const part of chunk(mine, LIMITS.accountDeletionChunk)) await anonymizeMembershipChunk(uid, part);
  onProgress?.('personal');
  await softDeletePersonal(uid);
}
/** Yeniden denenebilir: profil zaten silinmişse adım 1 atlanır, temizlik kaldığı yerden sürer. */
export async function deleteAccount(uid: string, onProgress?: (step: string) => void) {
  await markDeleted(uid);
  await resumeCleanup(uid, onProgress);
}
export { fromQuery };
