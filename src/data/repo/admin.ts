/* AdminRepository — süper admin işlemleri (T-37). */
import { doc, collection, getDocs, query, where, writeBatch, updateDoc, runTransaction, increment, getCountFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, ids, contactRef } from '../db';
import { fromDoc, fromQuery, baseCreate, touch, now, AppError } from '../fs';
import type { Club, Membership, User, Advisor } from '../models';
import { applicantOf } from './memberships';
import { addActivity } from './activity';
import { addNotification } from './notifications';
import { isNameTaken } from './clubs';
import { trLower } from '../../lib/util';

export interface ClubCreateInput {
  name: string; categoryId: string; iconName: string; founded: number; summary: string; about: string;
  palette: string; pattern: string; approvalRequired: boolean;
}
/** ADM-03: kulüp + başkan üyeliği (+ danışman üyeliği) tek batch. */
export async function createClub(input: ClubCreateInput, p: { president: User; presidentEmail: string; advisor?: Advisor | null; advisorUser?: User | null; advisorEmail?: string | null }): Promise<string> {
  const nameLower = trLower(input.name.trim());
  if (await isNameTaken(nameLower)) throw new AppError('nameTaken');
  const r = doc(collection(db, C.clubs)); const clubId = r.id; const pid = p.president.id;
  const b = writeBatch(db);
  b.set(r, {
    name: input.name.trim(), nameLower, categoryId: input.categoryId, iconName: input.iconName, palette: input.palette, pattern: input.pattern,
    coverSeed: `club-${clubId}`, logoPath: null, coverPath: null, memberCount: 1, approvalRequired: input.approvalRequired, applicationsOpen: true, requireNote: false,
    founded: input.founded, summary: input.summary.trim(), about: input.about.trim(), conditions: [], social: { email: null, instagram: null, web: null },
    presidentId: pid, pinnedPostId: null, advisor: p.advisor ? { name: p.advisor.name, title: p.advisor.title, userId: p.advisorUser?.id ?? null } : null,
    status: 'active', suspendReason: null, lastMembershipRef: `memberships/${ids.membership(clubId, pid)}`, ...baseCreate(),
  });
  const mem = (u: User, role: string) => ({ clubId, userId: u.id, status: 'active', role, note: '', applicant: applicantOf(u), appliedAt: now(), decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null, priorCount: 0, ...baseCreate() });
  b.set(ref(C.memberships, ids.membership(clubId, pid)), mem(p.president, 'president'));
  b.set(contactRef(ids.membership(clubId, pid)), { email: p.presidentEmail, emailLower: p.presidentEmail.toLowerCase(), ...baseCreate() });
  if (p.advisorUser && p.advisorUser.id !== pid) {
    b.set(ref(C.memberships, ids.membership(clubId, p.advisorUser.id)), mem(p.advisorUser, 'advisor'));
    if (p.advisorEmail) b.set(contactRef(ids.membership(clubId, p.advisorUser.id)), { email: p.advisorEmail, emailLower: p.advisorEmail.toLowerCase(), ...baseCreate() });
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
export const suspendUser = (uid: string, reason: string) => updateDoc(ref(C.users, uid), { status: 'suspended', suspendReason: reason.trim(), ...touch() });
export const activateUser = (uid: string) => updateDoc(ref(C.users, uid), { status: 'active', suspendReason: null, ...touch() });

/** M11 (süper) — hedef üye değilse aynı işlemde active/member üyelik oluşturulur (+1). */
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
    if (fromM && fromM.status === 'active' && fromM.role === 'president') tx.update(ref(C.memberships, ids.membership(clubId, from)), { role: 'board', ...touch() });
    if (toActive) tx.update(ref(C.memberships, ids.membership(clubId, to)), { role: 'president', ...touch() });
    else if (toM) tx.update(ref(C.memberships, ids.membership(clubId, to)), { status: 'active', role: 'president', applicant: applicantOf(toUser), appliedAt: now(), decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null, priorCount: (toM.priorCount || 0) + 1, ...touch() });
    else {
      tx.set(ref(C.memberships, ids.membership(clubId, to)), { clubId, userId: to, status: 'active', role: 'president', note: '', applicant: applicantOf(toUser), appliedAt: now(), decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null, priorCount: 0, ...baseCreate() });
      if (p.toEmail) tx.set(contactRef(ids.membership(clubId, to)), { email: p.toEmail, emailLower: p.toEmail.toLowerCase(), ...baseCreate() });
    }
    tx.update(ref(C.clubs, clubId), { presidentId: to, ...(toActive ? {} : { memberCount: increment(1), lastMembershipRef: `memberships/${ids.membership(clubId, to)}` }), ...touch() });
    addActivity(tx, { clubId, actorId: p.actorId, kind: 'role_changed', refs: { userId: to, role: 'president' } });
    addNotification(tx, { type: 'role_changed', refs: { clubId, role: 'president' } }, to);
    if (fromM && fromM.status === 'active') addNotification(tx, { type: 'role_changed', refs: { clubId, role: 'board' } }, from);
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
      const data = { status: 'active', role: 'advisor', note: '', applicant: applicantOf(p.user), appliedAt: now(), decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null };
      if (newM) tx.update(ref(C.memberships, ids.membership(p.clubId, newId)), { ...data, priorCount: (newM.priorCount || 0) + 1, ...touch() });
      else {
        tx.set(ref(C.memberships, ids.membership(p.clubId, newId)), { clubId: p.clubId, userId: newId, ...data, priorCount: 0, ...baseCreate() });
        if (p.email) tx.set(contactRef(ids.membership(p.clubId, newId)), { email: p.email, emailLower: p.email.toLowerCase(), ...baseCreate() });
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
