/* AccountDeletionRepository — sıra sabit, her adım idempotent (T-29). Gönderi/yorum kalır, Auth kimliği silinmez. */
import { getDocs, query, where, writeBatch, increment, limit, type DocumentReference } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, ids, accountRef, contactRef } from '../db';
import { fromQuery, softDeletePayload, touch } from '../fs';
import type { Membership, Rsvp } from '../models';
import { listMine } from './memberships';
import { listMyRsvps } from './rsvps';
import { LIMITS } from '../../lib/constants';
import { chunk } from '../../lib/util';

export const DELETED_NAME = 'Silinmiş kullanıcı';
export async function precheck(uid: string): Promise<{ blockedBy: string[] }> {
  const mine = await listMine(uid);
  return { blockedBy: mine.filter((m) => m.status === 'active' && m.role === 'president').map((m) => m.clubId) };
}
export async function markDeleted(uid: string) {
  const b = writeBatch(db);
  b.update(ref(C.users, uid), { name: DELETED_NAME, nameLower: 'silinmiş kullanıcı', bio: '', interests: [], avatarPath: null, department: null, year: null, status: 'deleted', ...softDeletePayload(uid) });
  b.update(accountRef(uid), { email: '', emailLower: '', fcmTokens: [], ...touch() });
  await b.commit();
}
async function anonymizeMembershipChunk(uid: string, list: Membership[]) {
  const b = writeBatch(db);
  for (const m of list) {
    const mid = ids.membership(m.clubId, uid);
    const applicant = { name: DELETED_NAME, department: null, year: null, avatarSeed: m.applicant?.avatarSeed || uid };
    if (m.status === 'active') {
      b.update(ref(C.memberships, mid), { status: 'left', applicant, ...touch() });
      if (m.role !== 'advisor') b.update(ref(C.clubs, m.clubId), { memberCount: increment(-1), lastMembershipRef: `memberships/${mid}`, ...touch() });
    } else if (m.status === 'pending') b.update(ref(C.memberships, mid), { status: 'cancelled', applicant, ...touch() });
    else b.update(ref(C.memberships, mid), { applicant, ...touch() });
    b.update(contactRef(mid), { email: '', emailLower: '', ...touch() });
  }
  b.update(ref(C.users, uid), touch());
  await b.commit();
}
async function cancelRsvpChunk(uid: string, list: Rsvp[]) {
  const b = writeBatch(db);
  for (const r of list) {
    b.update(ref(C.rsvps, ids.rsvp(r.eventId, uid)), { status: 'cancelled', waitlistAt: null, ...touch() });
    b.update(ref(C.events, r.eventId), { [r.status === 'going' ? 'goingCount' : 'waitlistCount']: increment(-1), lastRsvpRef: `rsvps/${ids.rsvp(r.eventId, uid)}`, ...touch() });
  }
  b.update(ref(C.users, uid), touch());
  await b.commit();
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
/** 2 → son adımlar. Kesintide `users.status == 'deleted'` ile tekrar çağrılır. */
export async function resumeCleanup(uid: string, onProgress?: (step: string) => void) {
  const mine = (await listMine(uid)).filter((m) => m.status === 'active' || m.status === 'pending' || (m.applicant?.name && m.applicant.name !== DELETED_NAME));
  onProgress?.('memberships');
  for (const part of chunk(mine, LIMITS.accountDeletionChunk)) await anonymizeMembershipChunk(uid, part);
  onProgress?.('rsvps');
  const rsvps = (await listMyRsvps(uid)).filter((r) => r.status === 'going' || r.status === 'waitlist');
  for (const part of chunk(rsvps, LIMITS.accountDeletionChunk)) await cancelRsvpChunk(uid, part);
  onProgress?.('personal');
  await softDeletePersonal(uid);
}
export async function deleteAccount(uid: string, onProgress?: (step: string) => void) {
  await markDeleted(uid);
  await resumeCleanup(uid, onProgress);
}
export { fromQuery };
