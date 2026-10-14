/* RsvpRepository + AttendanceRepository — sayaç eşliği lastRsvpRef (CD-41); yoklama K-G penceresi. */
import { doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit, runTransaction, increment, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, ids } from '../db';
import { fromDoc, fromQuery, baseCreate, touch, now, AppError } from '../fs';
import type { ClubEvent, Rsvp, RsvpStatus } from '../models';
import { addNotification } from './notifications';
import { LIMITS } from '../../lib/constants';
import { ticketCode, parseTicketQr } from '../../lib/util';

const rRef = (e: string, u: string) => ref(C.rsvps, ids.rsvp(e, u));
const rPath = (e: string, u: string) => `rsvps/${ids.rsvp(e, u)}`;
const eRef = (e: string) => ref(C.events, e);
export type Reminder = 'none' | '15m' | '1h' | '1d';

/**
 * Tx: going (yer varsa ve önde bekleyen yoksa) ya da waitlist; vazgeçilmiş kayıt aynı belge ve aynı bilet koduyla
 * güncellenir. Etkinliğe kayıt yolu yazılmaz (W-64): yalnızca sayaç + updatedAt.
 */
export async function joinEvent(p: { eventId: string; userId: string; reminder: Reminder }): Promise<RsvpStatus> {
  let result: RsvpStatus = 'going';
  await runTransaction(db, async (tx) => {
    const e = fromDoc<ClubEvent>(await tx.get(eRef(p.eventId)));
    const prev = fromDoc<Rsvp>(await tx.get(rRef(p.eventId, p.userId)));
    if (!e || e.isDeleted || e.status === 'draft') throw new AppError('notFound');
    if (e.status === 'cancelled') throw new AppError('eventCancelled');
    if (e.endsAt <= Date.now()) throw new AppError('eventEnded');
    if (!e.registrationOpen) throw new AppError('registrationClosed');
    if (prev && prev.status !== 'cancelled') throw new AppError('conflict');
    const going = e.capacity == null || (e.goingCount < e.capacity && (e.waitlistCount || 0) === 0);
    result = going ? 'going' : 'waitlist';
    if (prev) tx.update(rRef(p.eventId, p.userId), { status: result, reminder: p.reminder, waitlistAt: going ? null : now(), ...touch() });
    else tx.set(rRef(p.eventId, p.userId), { eventId: p.eventId, clubId: e.clubId, userId: p.userId, status: result, reminder: p.reminder, ticketCode: ticketCode(), ...(going ? {} : { waitlistAt: now() }), ...baseCreate() });
    tx.update(eRef(p.eventId), { [going ? 'goingCount' : 'waitlistCount']: increment(1), ...touch() });
  });
  return result;
}
/** Tx: going|waitlist → cancelled (yalnızca status; otomatik terfi yok, Mod C). */
export async function cancelRsvp(eventId: string, userId: string) {
  await runTransaction(db, async (tx) => {
    const r = fromDoc<Rsvp>(await tx.get(rRef(eventId, userId)));
    const e = fromDoc<ClubEvent>(await tx.get(eRef(eventId)));
    if (!r || (r.status !== 'going' && r.status !== 'waitlist')) throw new AppError(r?.status === 'attended' ? 'alreadyAttended' : 'conflict');
    if (e && e.endsAt <= Date.now()) throw new AppError('eventEnded');
    tx.update(rRef(eventId, userId), { status: 'cancelled', ...touch() });
    tx.update(eRef(eventId), { [r.status === 'going' ? 'goingCount' : 'waitlistCount']: increment(-1), ...touch() });
  });
}
export async function setReminder(eventId: string, userId: string, reminder: Reminder) {
  const r = fromDoc<Rsvp>(await getDoc(rRef(eventId, userId)));
  if (!r || (r.status !== 'going' && r.status !== 'waitlist')) throw new AppError('notRegistered');
  await updateDoc(rRef(eventId, userId), { reminder, ...touch() });
}
export async function getMyRsvp(eventId: string, userId: string): Promise<Rsvp | null> {
  return fromDoc<Rsvp>(await getDoc(rRef(eventId, userId)));
}
export function watchMyRsvp(eventId: string, userId: string, cb: (r: Rsvp | null) => void, onErr?: (e: unknown) => void) {
  return onSnapshot(rRef(eventId, userId), (s) => cb(fromDoc<Rsvp>(s)), (e) => { console.warn('bilet akışı', e); onErr?.(e); });
}
export async function listMyRsvps(userId: string): Promise<Rsvp[]> {
  return fromQuery<Rsvp>(await getDocs(query(col(C.rsvps), where('userId', '==', userId), where('isDeleted', '==', false), orderBy('createdAt', 'desc'), limit(500))));
}
/* ---------- yoklama (yönetici) ---------- */
export const attendanceWindowOpen = (e: Pick<ClubEvent, 'startsAt' | 'endsAt'>, t = Date.now()) =>
  t >= e.startsAt - LIMITS.attendanceWindowBeforeMs && t <= e.endsAt + LIMITS.attendanceWindowAfterMs;
export function watchParticipants(eventId: string, clubId: string, cb: (list: Rsvp[]) => void, onErr?: (e: unknown) => void) {
  return onSnapshot(query(col(C.rsvps), where('eventId', '==', eventId), where('clubId', '==', clubId)), (qs) => cb(fromQuery<Rsvp>(qs)), (e) => { console.warn('katılımcı akışı', e); onErr?.(e); });
}
export async function listParticipants(eventId: string, clubId: string, statuses?: RsvpStatus[]): Promise<Rsvp[]> {
  const qs = await getDocs(query(col(C.rsvps), where('eventId', '==', eventId), where('clubId', '==', clubId), ...(statuses ? [where('status', 'in', statuses)] : [])));
  return fromQuery<Rsvp>(qs);
}
export async function findByTicket(eventId: string, clubId: string, code: string): Promise<Rsvp | null> {
  const qs = await getDocs(query(col(C.rsvps), where('eventId', '==', eventId), where('clubId', '==', clubId), where('ticketCode', '==', code), limit(1)));
  return qs.empty ? null : fromQuery<Rsvp>(qs)[0];
}
export type ScanOutcome = { outcome: 'valid' | 'alreadyScanned' | 'invalid'; rsvp?: Rsvp };
/** SHT-24 — QR yükü veya elle girilen kod. */
export async function scanTicket(p: { event: ClubEvent; input: string; actorId: string }): Promise<ScanOutcome> {
  const raw = p.input.trim().toUpperCase();
  const parsed = parseTicketQr(p.input) || (/^GU-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(raw) ? { eventId: p.event.id, code: raw } : null);
  if (!parsed || parsed.eventId !== p.event.id) return { outcome: 'invalid' };
  if (!attendanceWindowOpen(p.event)) throw new AppError('attendanceWindowClosed');
  const r = await findByTicket(p.event.id, p.event.clubId, parsed.code);
  if (!r || r.status === 'cancelled' || r.status === 'waitlist') return { outcome: 'invalid', rsvp: r || undefined };
  if (r.status === 'attended') return { outcome: 'alreadyScanned', rsvp: r };
  try { await markAttended({ eventId: p.event.id, userId: r.userId, actorId: p.actorId, attended: true }); }
  catch (e) { if (e instanceof AppError && e.code === 'conflict') return { outcome: 'alreadyScanned', rsvp: r }; throw e; }
  return { outcome: 'valid', rsvp: { ...r, status: 'attended' } };
}
/** Yönetici sayaç yazımlarının işaretçisi (W-64): etkinlik belgesinde değil, `events/{id}/private/counter` yan belgesinde. */
const counterDoc = (eventId: string) => doc(db, C.events, eventId, 'private', 'counter');
const counterPayload = (clubId: string, eventId: string, userId: string) => ({ clubId, lastRsvpRef: rPath(eventId, userId), updatedAt: now() });
export async function markAttended(p: { eventId: string; userId: string; actorId: string; attended: boolean }) {
  await runTransaction(db, async (tx) => {
    const e = fromDoc<ClubEvent>(await tx.get(eRef(p.eventId)));
    const r = fromDoc<Rsvp>(await tx.get(rRef(p.eventId, p.userId)));
    if (!e) throw new AppError('notFound');
    if (!attendanceWindowOpen(e)) throw new AppError('attendanceWindowClosed');
    if (!r || r.status !== (p.attended ? 'going' : 'attended')) throw new AppError('conflict');
    tx.update(rRef(p.eventId, p.userId), p.attended
      ? { status: 'attended', scannedAt: now(), scannedBy: p.actorId, ...touch() }
      : { status: 'going', scannedAt: null, scannedBy: null, ...touch() });
    tx.update(eRef(p.eventId), { attendedCount: increment(p.attended ? 1 : -1), ...touch() });
    tx.set(counterDoc(p.eventId), counterPayload(e.clubId, p.eventId, p.userId));
  });
}
/** DLG-17: her rsvp ayrı Tx, sıralı; attended olanlar atlanır (idempotent). */
export async function markAllAttended(p: { eventId: string; clubId: string; actorId: string; onProgress?: (done: number, total: number) => void }) {
  const going = await listParticipants(p.eventId, p.clubId, ['going']);
  const r = { succeeded: 0, conflicted: 0, failed: 0 };
  for (let i = 0; i < going.length; i++) {
    try { await markAttended({ eventId: p.eventId, userId: going[i].userId, actorId: p.actorId, attended: true }); r.succeeded++; }
    catch (e) { if (e instanceof AppError && e.code === 'attendanceWindowClosed') throw e; if (e instanceof AppError && e.code === 'conflict') r.conflicted++; else r.failed++; }
    p.onProgress?.(i + 1, going.length);
  }
  return r;
}
/** Tx: waitlist → going (yalnızca status; waitlistAt kalır) + sayaç (+1,−1) + yan belge işaretçisi + waitlist_promoted (aynı işlem). */
export async function promote(eventId: string, userId: string) {
  await runTransaction(db, async (tx) => {
    const e = fromDoc<ClubEvent>(await tx.get(eRef(eventId)));
    const r = fromDoc<Rsvp>(await tx.get(rRef(eventId, userId)));
    if (!e || e.status !== 'published' || e.isDeleted) throw new AppError('conflict');
    if (e.endsAt <= Date.now()) throw new AppError('eventEnded');
    if (e.capacity != null && e.goingCount >= e.capacity) throw new AppError('capacityFull');
    if (!r || r.status !== 'waitlist') throw new AppError('conflict');
    tx.update(rRef(eventId, userId), { status: 'going', ...touch() });
    tx.update(eRef(eventId), { goingCount: increment(1), waitlistCount: increment(-1), ...touch() });
    tx.set(counterDoc(eventId), counterPayload(e.clubId, eventId, userId));
    addNotification(tx, { type: 'waitlist_promoted', refs: { clubId: e.clubId, eventId } }, userId);
  });
}
