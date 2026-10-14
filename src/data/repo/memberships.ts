/* MembershipRepository — M1–M14 durum makinesi; her geçiş beklenen önceki durumu transaction içinde okur (DLG-18 = conflict). */
import { getDoc, getDocs, onSnapshot, query, where, orderBy, limit, startAfter, runTransaction, increment, writeBatch, Timestamp, type Transaction, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, ids, contactRef, clubCounterRef, type Page } from '../db';
import { fromDoc, fromQuery, baseCreate, touch, now, AppError } from '../fs';
import type { Club, ClubRole, Membership, User, Applicant } from '../models';
import { addActivity, activityId } from './activity';
import { addNotification, fanOut, eventKeyOf, newEventKey } from './notifications';
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

/**
 * M1–M4 ortak giriş (FirebaseMembershipRepository._enter): tek transaction — üyelik + private/contact
 * (e-posta + başvuru notu; not üyelik belgesinde DURMAZ, CD-137) + anında katılımda memberCount +1 + günlük
 * (sabit kimlik `{clubId}_{uid}_{kind}_{priorCount}`). Kulüp belgesine üyeliğin yolu yazılmaz (CD-137 madde 8q).
 */
async function enter(p: { clubId: string; applicant: User; email: string; note: string; instant: boolean }): Promise<number> {
  const { clubId, applicant, instant } = p; const uid = applicant.id;
  const note = instant ? '' : p.note.trim();
  let priorCount = 0;
  await runTransaction(db, async (tx) => {
    // Transaction kuralı: tüm okumalar yazımlardan önce.
    const club = fromDoc<Club>(await tx.get(clubRef(clubId)));
    const prev = fromDoc<Membership>(await tx.get(mRef(clubId, uid)));
    const hasContact = !!prev && (await tx.get(contactRef(ids.membership(clubId, uid)))).exists();
    if (!club || club.isDeleted) throw new AppError('notFound');
    if (club.status !== 'active' || !club.applicationsOpen) throw new AppError('applicationsClosed');
    switch (prev?.status) {
      case 'pending': case 'active': throw new AppError('conflict');
      case 'rejected': case 'removed':
        if (prev.retryAfter && Date.now() < prev.retryAfter) throw new AppError('retryCooldown');
        // M4'ün hedefi her zaman pending (onaysız kulüpte de yönetici onayı)
        if (instant) throw new AppError('reapplyNeedsReview');
        break;
      case 'cancelled':
        // M3 (cancelled): hedef her kulüpte pending
        if (instant) throw new AppError('reapplyNeedsReview');
        break;
      default:
        // M1 / M2 / M3 (left): yol kulübün katılım biçimiyle aynı olmalı
        if (club.approvalRequired === instant) throw new AppError(instant ? 'approvalRequired' : 'conflict');
    }
    if (!instant && club.requireNote && !note) throw new AppError('noteRequired');
    priorCount = prev ? (prev.priorCount || 0) + 1 : 0;
    const status = instant ? 'active' : 'pending';
    if (!prev) {
      tx.set(mRef(clubId, uid), { clubId, userId: uid, status, role: 'member', applicant: applicantOf(applicant), priorCount: 0, appliedAt: now(), ...baseCreate() });
    } else {
      tx.update(mRef(clubId, uid), { status, role: 'member', applicant: applicantOf(applicant), appliedAt: now(), priorCount, ...cleared, ...touch() });
    }
    const cRef = contactRef(ids.membership(clubId, uid));
    if (hasContact) tx.update(cRef, { note, ...touch() });
    else tx.set(cRef, { email: p.email, emailLower: p.email.toLowerCase(), note, ...baseCreate() });
    if (instant) tx.update(clubRef(clubId), { memberCount: increment(1), ...touch() });
    const kind = instant ? 'member_joined' : 'application_received';
    addActivity(tx, { clubId, actorId: uid, kind, refs: { userId: uid }, id: activityId(clubId, uid, kind, priorCount) });
  });
  return priorCount;
}
/** M1/M3/M4 — başvur (pending). Yöneticilere application_received: işlem kesinleştikten sonra, alıcı başına ayrı batch. */
export async function apply(p: { clubId: string; applicant: User; email: string; note: string }) {
  const priorCount = await enter({ ...p, instant: false });
  try {
    const managers = (await listManagerIds(p.clubId)).filter((u) => u !== p.applicant.id);
    const d = { type: 'application_received', refs: { clubId: p.clubId, applicantId: p.applicant.id } };
    const key = eventKeyOf(d.type, d.refs, { priorCount });
    // Rules alıcının yönetici üyeliğini okur: parça boyu 1
    for (const m of managers) await fanOut(d, [m], undefined, { key, chunkSize: 1 });
  } catch (e) { console.warn(e); }
}
/** M2/M3 — anında katıl (+memberCount). */
export async function joinInstant(p: { clubId: string; applicant: User; email: string }) {
  await enter({ ...p, note: '', instant: true });
}
/** M7 — yalnızca status. */
export async function cancelApplication(clubId: string, userId: string) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'pending') throw new AppError('conflict');
    tx.update(mRef(clubId, userId), { status: 'cancelled', ...touch() });
  });
}
/** T-16 not düzenleme — yalnızca private/contact.note (üyelik belgesi yazılmaz). */
export async function updateApplicationNote(clubId: string, userId: string, note: string) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    const club = fromDoc<Club>(await tx.get(clubRef(clubId)));
    if (!m || m.status !== 'pending') throw new AppError('conflict');
    if (club?.requireNote && !note.trim()) throw new AppError('noteRequired');
    tx.update(contactRef(ids.membership(clubId, userId)), { note: note.trim(), ...touch() });
  });
}
/** M8 — üyelik (left) + memberCount −1 + günlük (mevcut priorCount ile). */
export async function leave(clubId: string, userId: string) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'active') throw new AppError('conflict');
    if (m.role === 'president') throw new AppError('presidentCannotLeave');
    if (m.role === 'advisor') throw new AppError('notMember');
    tx.update(mRef(clubId, userId), { status: 'left', ...touch() });
    tx.update(clubRef(clubId), { memberCount: increment(-1), ...touch() });
    addActivity(tx, { clubId, actorId: userId, kind: 'member_left', refs: { userId }, id: activityId(clubId, userId, 'member_left', m.priorCount || 0) });
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
export interface Contact { email: string; note: string }
/** private/contact — başvuranın e-postası ve başvuru notu (sahibi + kulüp yönetimi okur). */
export async function readContact(clubId: string, userId: string): Promise<Contact | null> {
  try { const s = await getDoc(contactRef(ids.membership(clubId, userId))); return s.exists() ? { email: (s.data().email as string) || '', note: (s.data().note as string) || '' } : null; } catch { return null; }
}
/** Ekranlar başvuru notunu üyelik nesnesinde (`note`) okur: iletişim belgelerinden doldurur. */
export async function withNotes(list: Membership[]): Promise<Membership[]> {
  const cs = await Promise.all(list.map((m) => readContact(m.clubId, m.userId)));
  return list.map((m, i) => ({ ...m, note: cs[i]?.note || '' }));
}

/* ---------- yönetici geçişleri ---------- */
/**
 * Yönetici sayaç geçişi: `memberCount ±1` (yalnızca bu alan) + AYNI işlemde yan belge
 * `clubs/{clubId}/private/counter` {clubId, lastMembershipRef, updatedAt} — kural, işaretçinin gösterdiği
 * üyeliğin doğru geçişi yaptığını görür (etkinliklerin `events/{id}/private/counter` deseni, W-64).
 */
function bumpManaged(tx: Transaction, clubId: string, userId: string, d: 1 | -1) {
  tx.update(clubRef(clubId), { memberCount: increment(d), ...touch() });
  tx.set(clubCounterRef(clubId), { clubId, lastMembershipRef: mPath(clubId, userId), updatedAt: now() });
}
/** Yönetici günlüğü: aynı geçiş geri alınıp yinelenebildiği için kimlik olay başına rastgele anahtarlıdır. */
const mgmtActivity = (tx: Transaction, clubId: string, actorId: string, kind: string, refs: Record<string, string>) =>
  addActivity(tx, { clubId, actorId, kind, refs, id: activityId(clubId, actorId, kind, newEventKey()) });
/** M5 */
export async function approve(clubId: string, userId: string, actorId: string) {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'pending') throw new AppError('conflict');
    tx.update(mRef(clubId, userId), { status: 'active', role: 'member', decidedAt: now(), decidedBy: actorId, ...touch() });
    bumpManaged(tx, clubId, userId, 1);
    mgmtActivity(tx, clubId, actorId, 'application_approved', { userId });
    addNotification(tx, { type: 'application_approved', refs: { clubId } }, userId);
  });
}
/** M6 */
export async function reject(clubId: string, userId: string, actorId: string, reason: string, rejectNote = '') {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'pending') throw new AppError('conflict');
    const note = rejectNote.trim();
    tx.update(mRef(clubId, userId), { status: 'rejected', decidedAt: now(), decidedBy: actorId, retryAfter: Timestamp.fromMillis(Date.now() + LIMITS.reapplyCooldownMs), rejectReason: reason, rejectNote: note || null, ...touch() });
    mgmtActivity(tx, clubId, actorId, 'application_rejected', { userId });
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
    if (m.status === 'active') bumpManaged(tx, clubId, userId, -1);
  });
}
/** M12 (b) — çıkarmayı geri al (önceki rolüne döner: üye ya da yönetim kurulu). */
export async function undoRemoval(clubId: string, userId: string, actorId: string, role: 'member' | 'board' = 'member') {
  await runTransaction(db, async (tx) => {
    const m = fromDoc<Membership>(await tx.get(mRef(clubId, userId)));
    if (!m || m.status !== 'removed') throw new AppError('conflict');
    if (m.decidedBy !== actorId || !m.decidedAt || Date.now() >= m.decidedAt + LIMITS.managerUndoWindowMs) throw new AppError('undoExpired');
    tx.update(mRef(clubId, userId), { status: 'active', role, ...cleared, ...touch() });
    bumpManaged(tx, clubId, userId, 1);
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
    const note = (p.note || '').trim();
    tx.update(mRef(p.clubId, p.userId), { status: 'removed', decidedAt: now(), decidedBy: p.actorId, retryAfter: Timestamp.fromMillis(Date.now() + LIMITS.reapplyCooldownMs), rejectReason: 'other', rejectNote: note || null, ...touch() });
    bumpManaged(tx, p.clubId, p.userId, -1);
    mgmtActivity(tx, p.clubId, p.actorId, 'member_removed', { userId: p.userId });
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
    mgmtActivity(tx, clubId, actorId, 'role_changed', { userId, role });
    addNotification(tx, { type: 'role_changed', refs: { clubId, role } }, userId);
  });
}
/** M11 — tek işlem devir. */
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
    mgmtActivity(tx, clubId, actorId, 'role_changed', { userId: toUserId, role: 'president' });
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
