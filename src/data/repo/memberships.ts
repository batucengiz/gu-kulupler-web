/* MembershipRepository — M1–M14 durum makinesi; her geçiş beklenen önceki durumu transaction içinde okur (DLG-18 = conflict). */
import { getDoc, getDocs, onSnapshot, query, where, orderBy, limit, startAfter, runTransaction, increment, writeBatch, Timestamp, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, ids, contactRef, type Page } from '../db';
import { fromDoc, fromQuery, baseCreate, touch, now, AppError } from '../fs';
import type { Club, ClubRole, Membership, User, Applicant } from '../models';
import { addActivity } from './activity';
import { addNotification, fanOut } from './notifications';
import { LIMITS } from '../../lib/constants';

const mRef = (c: string, u: string) => ref(C.memberships, ids.membership(c, u));
const mPath = (c: string, u: string) => `memberships/${ids.membership(c, u)}`;
const clubRef = (c: string) => ref(C.clubs, c);
export const applicantOf = (u: User): Applicant => ({ name: u.name, department: u.department ?? null, year: u.year ?? null, avatarSeed: u.avatarSeed || u.id });
const cleared = { decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null };

export function watchMyMemberships(uid: string, cb: (list: Membership[]) => void, onErr?: (e: unknown) => void) {
  return onSnapshot(query(col(C.memberships), where('userId', '==', uid)), (qs) => cb(fromQuery<Membership>(qs)), (e) => { console.warn('üyelik akışı', e); onErr?.(e); });
}
export async function getMembership(clubId: string, userId: string): Promise<Membership | null> {
  return fromDoc<Membership>(await getDoc(mRef(clubId, userId)));
}
export async function listMine(uid: string): Promise<Membership[]> {
  return fromQuery<Membership>(await getDocs(query(col(C.memberships), where('userId', '==', uid))));
}

/** M1/M3/M4 — başvur (pending). Yöneticilere application_received fan-out batch sonrası. */
export async function apply(p: { clubId: string; applicant: User; email: string; note: string }) {
  const { clubId, applicant } = p; const uid = applicant.id;
  await runTransaction(db, async (tx) => {
    const cs = await tx.get(clubRef(clubId)); const club = fromDoc<Club>(cs);
    if (!club || club.isDeleted) throw new AppError('notFound');
    if (club.status !== 'active' || !club.applicationsOpen) throw new AppError('applicationsClosed');
    if (club.requireNote && !p.note.trim()) throw new AppError('noteRequired');
    const ms = await tx.get(mRef(clubId, uid)); const prev = fromDoc<Membership>(ms);
    if (prev && (prev.status === 'pending' || prev.status === 'active')) throw new AppError('conflict');
    if (prev && (prev.status === 'rejected' || prev.status === 'removed') && prev.retryAfter && Date.now() < prev.retryAfter) throw new AppError('retryCooldown');
    const data = { status: 'pending', role: 'member', note: p.note.trim(), applicant: applicantOf(applicant), appliedAt: now(), priorCount: prev ? (prev.priorCount || 0) + 1 : 0, ...cleared };
    if (prev) tx.update(mRef(clubId, uid), { ...data, ...touch() });
    else {
      tx.set(mRef(clubId, uid), { clubId, userId: uid, ...data, ...baseCreate() });
      tx.set(contactRef(ids.membership(clubId, uid)), { email: p.email, emailLower: p.email.toLowerCase(), ...baseCreate() });
    }
    addActivity(tx, { clubId, actorId: uid, kind: 'application_received', refs: { userId: uid } });
  });
  // fan-out: kulüp yöneticileri (rules: refs.applicantId == uid)
  try { const managers = await listManagerIds(clubId); await fanOut({ type: 'application_received', refs: { clubId, applicantId: uid } }, managers, uid); } catch (e) { console.warn(e); }
}
/** M2/M3 — anında katıl (+memberCount). */
export async function joinInstant(p: { clubId: string; applicant: User; email: string }) {
  const { clubId, applicant } = p; const uid = applicant.id;
  await runTransaction(db, async (tx) => {
    const club = fromDoc<Club>(await tx.get(clubRef(clubId)));
    if (!club || club.isDeleted) throw new AppError('notFound');
    if (club.status !== 'active' || !club.applicationsOpen) throw new AppError('applicationsClosed');
    if (club.approvalRequired) throw new AppError('approvalRequired');
    const prev = fromDoc<Membership>(await tx.get(mRef(clubId, uid)));
    if (prev && (prev.status === 'pending' || prev.status === 'active')) throw new AppError('conflict');
    if (prev && (prev.status === 'rejected' || prev.status === 'removed')) {
      if (prev.retryAfter && Date.now() < prev.retryAfter) throw new AppError('retryCooldown');
      throw new AppError('reapplyNeedsReview');
    }
    const data = { status: 'active', role: 'member', note: '', applicant: applicantOf(applicant), appliedAt: now(), priorCount: prev ? (prev.priorCount || 0) + 1 : 0, ...cleared };
    if (prev) tx.update(mRef(clubId, uid), { ...data, ...touch() });
    else {
      tx.set(mRef(clubId, uid), { clubId, userId: uid, ...data, ...baseCreate() });
      tx.set(contactRef(ids.membership(clubId, uid)), { email: p.email, emailLower: p.email.toLowerCase(), ...baseCreate() });
    }
    tx.update(clubRef(clubId), { memberCount: increment(1), lastMembershipRef: mPath(clubId, uid), ...touch() });
    addActivity(tx, { clubId, actorId: uid, kind: 'member_joined', refs: { userId: uid } });
  });
}
/** M7 */
export async function cancelApplication(clubId: string, userId: string) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'pending') throw new AppError('conflict');
    tx.update(mRef(clubId, userId), { status: 'cancelled', ...touch() });
  });
}
/** T-16 not düzenleme */
export async function updateApplicationNote(clubId: string, userId: string, note: string) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'pending') throw new AppError('conflict');
    tx.update(mRef(clubId, userId), { note: note.trim(), ...touch() });
  });
}
/** M8 */
export async function leave(clubId: string, userId: string) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'active') throw new AppError('conflict');
    if (m.role === 'president') throw new AppError('presidentCannotLeave');
    if (m.role === 'advisor') throw new AppError('notMember');
    tx.update(mRef(clubId, userId), { status: 'left', ...touch() });
    tx.update(clubRef(clubId), { memberCount: increment(-1), lastMembershipRef: mPath(clubId, userId), ...touch() });
    addActivity(tx, { clubId, actorId: userId, kind: 'member_left', refs: { userId } });
  });
}

/* ---------- listeler ---------- */
export async function listActiveMembers(clubId: string, cursor?: QueryDocumentSnapshot<DocumentData> | null, role?: ClubRole, size: number = LIMITS.pageSize): Promise<Page<Membership>> {
  const qs = await getDocs(query(col(C.memberships), where('clubId', '==', clubId), where('status', '==', 'active'), ...(role ? [where('role', '==', role)] : []), orderBy('appliedAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(size)));
  return { items: fromQuery<Membership>(qs), cursor: qs.docs[qs.docs.length - 1] || null, hasMore: qs.docs.length === size };
}
/** Sayfasız tüm aktif üyeler (fan-out alıcıları, CLB-06 / MGT-03 tam liste). */
export async function listAllActive(clubId: string): Promise<Membership[]> {
  const out: Membership[] = []; let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  for (;;) { const p = await listActiveMembers(clubId, cursor, undefined, 500); out.push(...p.items); if (!p.hasMore) break; cursor = p.cursor; }
  return out;
}
export async function listByStatus(clubId: string, status: string, cursor?: QueryDocumentSnapshot<DocumentData> | null, size: number = 100): Promise<Page<Membership>> {
  const qs = await getDocs(query(col(C.memberships), where('clubId', '==', clubId), where('status', '==', status), orderBy('appliedAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(size)));
  return { items: fromQuery<Membership>(qs), cursor: qs.docs[qs.docs.length - 1] || null, hasMore: qs.docs.length === size };
}
export async function listManagers(clubId: string): Promise<Membership[]> {
  return fromQuery<Membership>(await getDocs(query(col(C.memberships), where('clubId', '==', clubId), where('status', '==', 'active'), where('role', 'in', ['board', 'president']))));
}
export const listManagerIds = async (clubId: string) => (await listManagers(clubId)).map((m) => m.userId);
export async function readContact(clubId: string, userId: string): Promise<string | null> {
  try { const s = await getDoc(contactRef(ids.membership(clubId, userId))); return s.exists() ? (s.data().email as string) || null : null; } catch { return null; }
}

/* ---------- yönetici geçişleri ---------- */
/** M5 */
export async function approve(clubId: string, userId: string, actorId: string) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'pending') throw new AppError('conflict');
    tx.update(mRef(clubId, userId), { status: 'active', role: 'member', decidedAt: now(), decidedBy: actorId, ...touch() });
    tx.update(clubRef(clubId), { memberCount: increment(1), lastMembershipRef: mPath(clubId, userId), ...touch() });
    addActivity(tx, { clubId, actorId, kind: 'application_approved', refs: { userId } });
    addNotification(tx, { type: 'application_approved', refs: { clubId } }, userId);
  });
}
/** M6 */
export async function reject(clubId: string, userId: string, actorId: string, reason: string, rejectNote = '') {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'pending') throw new AppError('conflict');
    tx.update(mRef(clubId, userId), { status: 'rejected', decidedAt: now(), decidedBy: actorId, retryAfter: Timestamp.fromMillis(Date.now() + LIMITS.reapplyCooldownMs), rejectReason: reason, rejectNote: rejectNote.trim() || null, ...touch() });
    addActivity(tx, { clubId, actorId, kind: 'application_rejected', refs: { userId } });
    addNotification(tx, { type: 'application_rejected', refs: { clubId } }, userId);
  });
}
/** M12 (a) — 30 sn içinde kararı geri al. */
export async function undoDecision(clubId: string, userId: string, actorId: string) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || (m.status !== 'active' && m.status !== 'rejected')) throw new AppError('conflict');
    if (m.decidedBy !== actorId || !m.decidedAt || Date.now() >= m.decidedAt + LIMITS.managerUndoWindowMs) throw new AppError('undoExpired');
    tx.update(mRef(clubId, userId), { status: 'pending', ...cleared, ...touch() });
    if (m.status === 'active') tx.update(clubRef(clubId), { memberCount: increment(-1), lastMembershipRef: mPath(clubId, userId), ...touch() });
  });
}
/** M12 (b) — çıkarmayı geri al. */
export async function undoRemoval(clubId: string, userId: string, actorId: string) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'removed') throw new AppError('conflict');
    if (m.decidedBy !== actorId || !m.decidedAt || Date.now() >= m.decidedAt + LIMITS.managerUndoWindowMs) throw new AppError('undoExpired');
    tx.update(mRef(clubId, userId), { status: 'active', role: 'member', ...cleared, ...touch() });
    tx.update(clubRef(clubId), { memberCount: increment(1), lastMembershipRef: mPath(clubId, userId), ...touch() });
  });
}
/** M9 */
export async function remove(p: { clubId: string; userId: string; actorId: string; actorRole: ClubRole | null; actorIsSuper: boolean; note?: string }) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(p.clubId, p.userId)));
    if (!m || m.status !== 'active') throw new AppError('conflict');
    if (m.role !== 'member' && m.role !== 'board') throw new AppError('cannotRemove');
    const allowed = p.actorIsSuper || p.actorRole === 'president' || (p.actorRole === 'board' && m.role === 'member');
    if (!allowed) throw new AppError('forbidden');
    tx.update(mRef(p.clubId, p.userId), { status: 'removed', decidedAt: now(), decidedBy: p.actorId, retryAfter: Timestamp.fromMillis(Date.now() + LIMITS.reapplyCooldownMs), rejectReason: 'other', rejectNote: (p.note || '').trim() || null, ...touch() });
    tx.update(clubRef(p.clubId), { memberCount: increment(-1), lastMembershipRef: mPath(p.clubId, p.userId), ...touch() });
    addActivity(tx, { clubId: p.clubId, actorId: p.actorId, kind: 'member_removed', refs: { userId: p.userId } });
    addNotification(tx, { type: 'removed_from_club', refs: { clubId: p.clubId } }, p.userId);
  });
}
/** M10 */
export async function changeRole(clubId: string, userId: string, role: 'member' | 'board', actorId: string) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'active') throw new AppError('conflict');
    if (m.role !== 'member' && m.role !== 'board') throw new AppError('cannotChangeRole');
    if (m.role === role) return;
    tx.update(mRef(clubId, userId), { role, ...touch() });
    addActivity(tx, { clubId, actorId, kind: 'role_changed', refs: { userId, role } });
    addNotification(tx, { type: 'role_changed', refs: { clubId, role } }, userId);
  });
}
/** M11 — tek batch devir. */
export async function transferPresidency(clubId: string, fromUserId: string, toUserId: string, actorId: string) {
  await runTransaction(db, async (tx) => {
    const club = fromDoc<Club>(await tx.get(clubRef(clubId)));
    const from = fromDoc<Membership>(await tx.get(mRef(clubId, fromUserId)));
    const to = fromDoc<Membership>(await tx.get(mRef(clubId, toUserId)));
    if (!club || !from || from.role !== 'president' || from.status !== 'active') throw new AppError('conflict');
    if (!to || to.status !== 'active' || (to.role !== 'member' && to.role !== 'board')) throw new AppError('conflict');
    tx.update(mRef(clubId, fromUserId), { role: 'board', ...touch() });
    tx.update(mRef(clubId, toUserId), { role: 'president', ...touch() });
    tx.update(clubRef(clubId), { presidentId: toUserId, ...touch() });
    addActivity(tx, { clubId, actorId, kind: 'role_changed', refs: { userId: toUserId, role: 'president' } });
    addNotification(tx, { type: 'role_changed', refs: { clubId, role: 'president' } }, toUserId);
    addNotification(tx, { type: 'role_changed', refs: { clubId, role: 'board' } }, fromUserId);
  });
}
/** BulkResult (DLG-17): her başvuru ayrı transaction. */
export async function bulk(userIds: string[], fn: (u: string) => Promise<void>, onProgress?: (done: number, total: number) => void) {
  const r = { succeeded: 0, conflicted: 0, failed: 0 };
  for (let i = 0; i < userIds.length; i++) {
    try { await fn(userIds[i]); r.succeeded++; } catch (e) { if (e instanceof AppError && e.code === 'conflict') r.conflicted++; else r.failed++; }
    onProgress?.(i + 1, userIds.length);
  }
  return r;
}
export { writeBatch };
