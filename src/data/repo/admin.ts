/* AdminRepository — süper admin işlemleri (T-37). */
import { doc, collection, getDocs, query, where, writeBatch, updateDoc, runTransaction, increment, getCountFromServer, type Transaction, type WriteBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, ids, contactRef, accountRef, clubCounterRef } from '../db';
import { fromDoc, fromQuery, baseCreate, touch, now, AppError } from '../fs';
import type { Club, Membership, User, Advisor } from '../models';
import { applicantOf } from './memberships';
import { addActivity, activityId } from './activity';
import { addNotification, newEventKey } from './notifications';
import { isNameTaken } from './clubs';
import { trLower } from '../../lib/util';

export interface ClubCreateInput {
  name: string; categoryId: string; iconName: string; founded: number; summary: string; about: string;
  palette: string; pattern: string; approvalRequired: boolean;
}
/** Süper admin günlüğü / bildirimi — olay başına rastgele anahtar (yönetici geçişleriyle aynı). */
const adminActivity = (w: Transaction | WriteBatch, clubId: string, actorId: string, kind: string, refs: Record<string, string>) =>
  addActivity(w, { clubId, actorId, kind, refs, id: activityId(clubId, actorId, kind, newEventKey()) });
/** Süper adminin oluşturduğu `active` üyelik: null alanların anahtarı yazılmaz (W-51), not üyelikte durmaz. */
const newMembership = (clubId: string, u: User, role: 'president' | 'advisor') =>
  ({ clubId, userId: u.id, status: 'active', role, applicant: applicantOf(u), appliedAt: now(), priorCount: 0, ...baseCreate() });
const reactivated = (u: User, role: 'president' | 'advisor', priorCount: number) =>
  ({ status: 'active', role, applicant: applicantOf(u), appliedAt: now(), decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null, priorCount, ...touch() });
const newContact = (email: string) => ({ email, emailLower: email.toLowerCase(), note: '', ...baseCreate() });

/** ADM-03: kulüp + başkan üyeliği (+ danışman üyeliği) tek batch. */
export async function createClub(input: ClubCreateInput, p: { president: User; presidentEmail: string; advisor?: Advisor | null; advisorUser?: User | null; advisorEmail?: string | null }): Promise<string> {
  const nameLower = trLower(input.name.trim());
  if (await isNameTaken(nameLower)) throw new AppError('nameTaken');
  const r = doc(collection(db, C.clubs)); const clubId = r.id; const pid = p.president.id;
  const advisorUserId = p.advisorUser && p.advisorUser.id !== pid ? p.advisorUser.id : null;
  const b = writeBatch(db);
  b.set(r, {
    name: input.name.trim(), nameLower, categoryId: input.categoryId, iconName: input.iconName, palette: input.palette, pattern: input.pattern,
    coverSeed: `club-${clubId}`, memberCount: 1, approvalRequired: input.approvalRequired, applicationsOpen: true, requireNote: false,
    founded: input.founded, summary: input.summary.trim(), about: input.about.trim(), conditions: [], social: { email: null, instagram: null, web: null },
    presidentId: pid, advisor: p.advisor ? { name: p.advisor.name, title: p.advisor.title, userId: advisorUserId } : null,
    status: 'active', ...baseCreate(),
  });
  b.set(ref(C.memberships, ids.membership(clubId, pid)), newMembership(clubId, p.president, 'president'));
  b.set(contactRef(ids.membership(clubId, pid)), newContact(p.presidentEmail));
  if (p.advisorUser && advisorUserId) {
    b.set(ref(C.memberships, ids.membership(clubId, advisorUserId)), newMembership(clubId, p.advisorUser, 'advisor'));
    if (p.advisorEmail) b.set(contactRef(ids.membership(clubId, advisorUserId)), newContact(p.advisorEmail));
  }
  await b.commit();
  return clubId;
}
export interface ClubIdentityPatch { name: string; categoryId: string; iconName: string; founded: number; advisor: Advisor | null }
export async function updateClubIdentity(clubId: string, patch: ClubIdentityPatch) {
  const nameLower = trLower(patch.name.trim());
  if (await isNameTaken(nameLower, clubId)) throw new AppError('nameTaken');
  await updateDoc(ref(C.clubs, clubId), { name: patch.name.trim(), nameLower, categoryId: patch.categoryId, iconName: patch.iconName, founded: patch.founded, advisor: patch.advisor, ...touch() });
}
export const suspendClub = (clubId: string, reason: string) => updateDoc(ref(C.clubs, clubId), { status: 'suspended', suspendReason: reason.trim(), ...touch() });
export const activateClub = (clubId: string) => updateDoc(ref(C.clubs, clubId), { status: 'active', suspendReason: null, ...touch() });
/** Kullanıcı askısı: durum `users`'ta, gerekçe `users/{uid}/private/account.suspendReason`'da (CD-133) — tek batch. */
export async function suspendUser(uid: string, reason: string) {
  const b = writeBatch(db);
  b.update(ref(C.users, uid), { status: 'suspended', ...touch() });
  b.update(accountRef(uid), { suspendReason: reason.trim(), ...touch() });
  await b.commit();
}
export async function activateUser(uid: string) {
  const b = writeBatch(db);
  b.update(ref(C.users, uid), { status: 'active', ...touch() });
  b.update(accountRef(uid), { suspendReason: null, ...touch() });
  await b.commit();
}

/** M11 (süper) — hedef üye değilse aynı işlemde active üyelik oluşturulur (+1, işaretçi yan belgede). */
export async function assignPresident(p: { clubId: string; toUser: User; toEmail?: string | null; actorId: string }) {
  const { clubId, toUser } = p; const to = toUser.id;
  await runTransaction(db, async (tx) => {
    const club = fromDoc<Club>(await tx.get(ref(C.clubs, clubId)));
    if (!club) throw new AppError('notFound');
    const from = club.presidentId;
    if (from === to) return;
    const fromM = from ? fromDoc<Membership>(await tx.get(ref(C.memberships, ids.membership(clubId, from)))) : null;
    const toM = fromDoc<Membership>(await tx.get(ref(C.memberships, ids.membership(clubId, to))));
    if (toM && toM.status === 'active' && toM.role === 'advisor') throw new AppError('advisorCannotBePresident');
    const toActive = !!toM && toM.status === 'active';
    const fromActive = !!fromM && fromM.status === 'active' && fromM.role === 'president';
    if (fromActive) tx.update(ref(C.memberships, ids.membership(clubId, from!)), { role: 'board', ...touch() });
    if (toActive) tx.update(ref(C.memberships, ids.membership(clubId, to)), { role: 'president', ...touch() });
    else if (toM) tx.update(ref(C.memberships, ids.membership(clubId, to)), reactivated(toUser, 'president', (toM.priorCount || 0) + 1));
    else {
      tx.set(ref(C.memberships, ids.membership(clubId, to)), newMembership(clubId, toUser, 'president'));
      if (p.toEmail) tx.set(contactRef(ids.membership(clubId, to)), newContact(p.toEmail));
    }
    tx.update(ref(C.clubs, clubId), { presidentId: to, ...(toActive ? {} : { memberCount: increment(1) }), ...touch() });
    if (!toActive) tx.set(clubCounterRef(clubId), { clubId, lastMembershipRef: `memberships/${ids.membership(clubId, to)}`, updatedAt: now() });
    adminActivity(tx, clubId, p.actorId, 'role_changed', { userId: to, role: 'president' });
    addNotification(tx, { type: 'role_changed', refs: { clubId, role: 'president' } }, to);
    if (fromActive) addNotification(tx, { type: 'role_changed', refs: { clubId, role: 'board' } }, from!);
  });
}
/** M13 — danışman ata/kaldır (memberCount değişmez). */
export async function setAdvisor(p: { clubId: string; advisor: Advisor | null; user?: User | null; email?: string | null }) {
  await runTransaction(db, async (tx) => {
    const club = fromDoc<Club>(await tx.get(ref(C.clubs, p.clubId)));
    if (!club) throw new AppError('notFound');
    const oldId = club.advisor?.userId || null; const newId = p.user?.id || null;
    const oldM = oldId ? fromDoc<Membership>(await tx.get(ref(C.memberships, ids.membership(p.clubId, oldId)))) : null;
    const newM = newId && newId !== oldId ? fromDoc<Membership>(await tx.get(ref(C.memberships, ids.membership(p.clubId, newId)))) : null;
    if (newM && newM.status === 'active' && newM.role !== 'advisor') throw new AppError('alreadyMember');
    if (oldM && oldId !== newId && oldM.status === 'active' && oldM.role === 'advisor') tx.update(ref(C.memberships, ids.membership(p.clubId, oldId!)), { status: 'left', ...touch() });
    if (newId && newId !== oldId && p.user) {
      if (newM) tx.update(ref(C.memberships, ids.membership(p.clubId, newId)), reactivated(p.user, 'advisor', (newM.priorCount || 0) + 1));
      else {
        tx.set(ref(C.memberships, ids.membership(p.clubId, newId)), newMembership(p.clubId, p.user, 'advisor'));
        if (p.email) tx.set(contactRef(ids.membership(p.clubId, newId)), newContact(p.email));
      }
    }
    tx.update(ref(C.clubs, p.clubId), { advisor: p.advisor ? { name: p.advisor.name, title: p.advisor.title, userId: newId } : null, ...touch() });
  });
}
export async function listManagerUserIds(): Promise<Set<string>> {
  const qs = await getDocs(query(col(C.memberships), where('status', '==', 'active'), where('role', 'in', ['board', 'president'])));
  return new Set(fromQuery<Membership>(qs).map((m) => m.userId));
}
export async function stats() {
  const [users, clubs, reports, events] = await Promise.all([
    getCountFromServer(query(col(C.users), where('isDeleted', '==', false))),
    getCountFromServer(query(col(C.clubs), where('isDeleted', '==', false))),
    getCountFromServer(query(col(C.reports), where('status', '==', 'open'))),
    getCountFromServer(query(col(C.events), where('status', '==', 'published'), where('isDeleted', '==', false))),
  ]);
  return { users: users.data().count, clubs: clubs.data().count, openReports: reports.data().count, publishedEvents: events.data().count };
}
export async function listAllClubs(): Promise<Club[]> {
  return fromQuery<Club>(await getDocs(query(col(C.clubs)))).sort((a, b) => a.nameLower.localeCompare(b.nameLower, 'tr'));
}

/** ADM-01: aralıktaki yeni kullanıcı sayısı. */
export async function countNewUsers(sinceMs: number): Promise<number> {
  const { Timestamp } = await import('firebase/firestore');
  const s = await getCountFromServer(query(col(C.users), where('isDeleted', '==', false), where('createdAt', '>=', Timestamp.fromMillis(sinceMs))));
  return s.data().count;
}
/** ADM-01: aralıkta biten yayımlanmış etkinliklerin katılım özeti (goingCount = kayıt, attendedCount = yoklama). */
export async function pastEventsSummary(sinceMs: number, untilMs: number): Promise<{ events: number; registered: number; attended: number }> {
  const { Timestamp } = await import('firebase/firestore');
  const qs = await getDocs(query(col(C.events), where('status', '==', 'published'), where('endsAt', '>=', Timestamp.fromMillis(sinceMs)), where('endsAt', '<', Timestamp.fromMillis(untilMs))));
  const list = fromQuery<{ goingCount: number; attendedCount: number; isDeleted: boolean }>(qs).filter((e) => !e.isDeleted);
  return { events: list.length, registered: list.reduce((a, e) => a + (e.goingCount || 0), 0), attended: list.reduce((a, e) => a + (e.attendedCount || 0), 0) };
}
/** ADM-05: askıdaki kullanıcılar. */
export async function listSuspendedUsers(): Promise<User[]> {
  return fromQuery<User>(await getDocs(query(col(C.users), where('status', '==', 'suspended'), where('isDeleted', '==', false))));
}
/** ADM-05: verilen kullanıcıların tüm üyelikleri (30'luk `in` parçaları). */
export async function membershipsOfUsers(userIds: string[]): Promise<Membership[]> {
  const out: Membership[] = [];
  for (let i = 0; i < userIds.length; i += 30) {
    const part = userIds.slice(i, i + 30); if (!part.length) continue;
    out.push(...fromQuery<Membership>(await getDocs(query(col(C.memberships), where('userId', 'in', part)))));
  }
  return out;
}
