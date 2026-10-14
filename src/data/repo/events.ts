/* EventRepository + ManagementRepository.publishEvent/cancelEvent — PLAN §10.4 (T-22/T-30). */
import { doc, collection, getDoc, getDocs, query, where, orderBy, limit, startAfter, writeBatch, updateDoc, runTransaction, documentId, Timestamp, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, type Page } from '../db';
import { fromDoc, fromQuery, baseCreate, touch, now, softDeletePayload, restorePayload, AppError } from '../fs';
import type { ClubEvent, Club, Rsvp } from '../models';
import { addActivity, activityId } from './activity';
import { fanOut } from './notifications';
import { listAllActive } from './memberships';
import { listByInterests } from './users';
import { LIMITS, interestIdsOf } from '../../lib/constants';
import { chunk, uniq } from '../../lib/util';

export interface EventDraft {
  title: string; desc: string; type: string; startsAt: number; endsAt: number; placeId: string | null; placeText: string | null;
  capacity: number | null; visibility: 'public' | 'members'; coverSeed: string; coverPalette: string; coverPattern: string;
  registrationOpen: boolean; autoReminder: boolean;
}
const eRef = (id: string) => ref(C.events, id);
export const newEventId = () => doc(collection(db, C.events)).id;
/** İçerik dalının alanları (coverSeed hariç: oluşturmada `event-{id}` olarak sabitlenir, sonra değişmez). */
const content = (d: EventDraft) => ({
  title: d.title.trim(), desc: d.desc.trim(), type: d.type, startsAt: Timestamp.fromMillis(d.startsAt), endsAt: Timestamp.fromMillis(d.endsAt),
  placeId: d.placeId || null, placeText: d.placeId ? null : (d.placeText || '').trim() || null, capacity: d.capacity ?? null, visibility: d.visibility,
  coverPalette: d.coverPalette, coverPattern: d.coverPattern, registrationOpen: d.registrationOpen, autoReminder: d.autoReminder,
});
/** null alanların anahtarı yazılmaz (W-51) — oluşturma yükü için. */
const withoutNulls = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null));

/** B: events set (+ yayınlanıyorsa günlük, sabit kimlik). Kapak yüklemesi sonra `update(coverPath)` ile (CD-47). */
export async function createEvent(d: EventDraft, p: { clubId: string; createdBy: string; status: 'draft' | 'published'; eventId?: string }): Promise<string> {
  if (p.status === 'published' && d.startsAt <= Date.now()) throw new AppError('eventEnded');
  const r = p.eventId ? eRef(p.eventId) : doc(collection(db, C.events));
  const b = writeBatch(db);
  b.set(r, {
    clubId: p.clubId, createdBy: p.createdBy, ...withoutNulls(content(d)), status: p.status, coverSeed: `event-${r.id}`,
    goingCount: 0, waitlistCount: 0, attendedCount: 0, ...baseCreate(), ...(p.status === 'published' ? { publishedAt: now() } : {}),
  });
  if (p.status === 'published') addActivity(b, { clubId: p.clubId, actorId: p.createdBy, kind: 'event_published', refs: { eventId: r.id }, id: activityId(p.clubId, p.createdBy, 'event_published', r.id) });
  await b.commit();
  return r.id;
}
export async function updateEvent(eventId: string, d: Partial<EventDraft> & { coverPath?: string | null }) {
  await runTransaction(db, async (tx) => {
    const e = fromDoc<ClubEvent>(await tx.get(eRef(eventId)));
    if (!e || e.isDeleted) throw new AppError('notFound');
    if (e.status === 'cancelled') throw new AppError('conflict');
    const full = { ...eventToDraft(e), ...d } as EventDraft;
    if (full.capacity != null && full.capacity < e.goingCount) throw new AppError('capacityBelowGoing');
    tx.update(eRef(eventId), { ...content(full), ...(d.coverPath !== undefined ? { coverPath: d.coverPath } : {}), ...touch() });
  });
}
export const setCoverPath = (eventId: string, coverPath: string | null) => updateDoc(eRef(eventId), { coverPath, ...touch() });
export function eventToDraft(e: ClubEvent): EventDraft {
  return { title: e.title, desc: e.desc, type: e.type, startsAt: e.startsAt, endsAt: e.endsAt, placeId: e.placeId, placeText: e.placeText, capacity: e.capacity,
    visibility: e.visibility, coverSeed: e.coverSeed, coverPalette: e.coverPalette, coverPattern: e.coverPattern, registrationOpen: e.registrationOpen, autoReminder: e.autoReminder };
}
/** Tx: draft → published (+ activity). */
export async function publish(eventId: string, actorId: string) {
  await runTransaction(db, async (tx) => {
    const e = fromDoc<ClubEvent>(await tx.get(eRef(eventId)));
    if (!e || e.isDeleted || e.status !== 'draft') throw new AppError('conflict');
    if (e.startsAt <= Date.now()) throw new AppError('eventEnded');
    tx.update(eRef(eventId), { status: 'published', publishedAt: now(), ...touch() });
    // yalnızca ilk yayın günlüğe düşer (sabit kimlik)
    if (!e.publishedAt) addActivity(tx, { clubId: e.clubId, actorId, kind: 'event_published', refs: { eventId }, id: activityId(e.clubId, actorId, 'event_published', eventId) });
  });
}
/** RecipientResolver.eventNew — üyeler (yayıncı + danışman hariç) ∪ public ise ilgi eşleşmeli ≤ 200. */
export async function eventNewRecipients(e: Pick<ClubEvent, 'clubId' | 'visibility'>, club: Club, actorId: string): Promise<{ ids: string[]; truncated: boolean }> {
  const members = (await listAllActive(e.clubId)).filter((m) => m.role !== 'advisor').map((m) => m.userId);
  let interest: string[] = []; let truncated = false;
  if (e.visibility === 'public') {
    const ints = interestIdsOf(club.categoryId);
    if (ints.length) {
      interest = await listByInterests(ints.slice(0, 10), LIMITS.eventNewInterestFanOutMax + 1);
      if (interest.length > LIMITS.eventNewInterestFanOutMax) { interest = interest.slice(0, LIMITS.eventNewInterestFanOutMax); truncated = true; }
    }
  }
  return { ids: uniq([...members, ...interest]).filter((u) => u !== actorId && u !== club.advisor?.userId), truncated };
}
export async function notifyEventNew(eventId: string, club: Club, e: Pick<ClubEvent, 'clubId' | 'visibility'>, actorId: string) {
  try {
    const set = await eventNewRecipients(e, club, actorId);
    if (set.truncated) console.warn('[fan-out] event_new alıcı listesi kısaltıldı');
    await fanOut({ type: 'event_new', refs: { clubId: club.id, eventId } }, set.ids, actorId);
  } catch (err) { console.warn('[fan-out] event_new', err); }
}
/** Tx: published → draft (K-F: goingCount == 0). */
export async function unpublish(eventId: string) {
  await runTransaction(db, async (tx) => {
    const e = fromDoc<ClubEvent>(await tx.get(eRef(eventId)));
    if (!e || e.status !== 'published') throw new AppError('conflict');
    // K-F: kayıtlı varken taslağa alınamaz; bekleme listesi engel değil, publishedAt korunur
    if (e.goingCount !== 0) throw new AppError('eventHasRegistrations');
    tx.update(eRef(eventId), { status: 'draft', ...touch() });
  });
}
/** Tx: published → cancelled + activity; sonra going+waitlist fan-out (force). */
export async function cancelEvent(eventId: string, reason: string, actorId: string) {
  if (!reason.trim()) throw new AppError('invalidArgument');
  let clubId = '';
  await runTransaction(db, async (tx) => {
    const e = fromDoc<ClubEvent>(await tx.get(eRef(eventId)));
    if (!e || e.status !== 'published') throw new AppError('conflict');
    clubId = e.clubId;
    tx.update(eRef(eventId), { status: 'cancelled', cancelReason: reason.trim(), ...touch() });
    addActivity(tx, { clubId: e.clubId, actorId, kind: 'event_cancelled', refs: { eventId }, id: activityId(e.clubId, actorId, 'event_cancelled', eventId) });
  });
  try {
    const qs = await getDocs(query(col(C.rsvps), where('eventId', '==', eventId), where('clubId', '==', clubId), where('status', 'in', ['going', 'waitlist'])));
    await fanOut({ type: 'event_cancelled', refs: { clubId, eventId } }, fromQuery<Rsvp>(qs).map((r) => r.userId), actorId);
  } catch (err) { console.warn('[fan-out] event_cancelled', err); }
}
export async function duplicate(e: ClubEvent, createdBy: string, copySuffix: string): Promise<string> {
  const d = eventToDraft(e);
  return createEvent({ ...d, title: `${d.title}${copySuffix}`.slice(0, LIMITS.eventTitleMax), startsAt: d.startsAt + LIMITS.eventCopyShiftMs, endsAt: d.endsAt + LIMITS.eventCopyShiftMs, registrationOpen: true },
    { clubId: e.clubId, createdBy, status: 'draft' });
}
export const setRegistrationOpen = (eventId: string, open: boolean) => updateDoc(eRef(eventId), { registrationOpen: open, ...touch() });
export async function softDeleteEvent(eventId: string, actorId: string) {
  await runTransaction(db, async (tx) => {
    const e = fromDoc<ClubEvent>(await tx.get(eRef(eventId)));
    if (!e || e.status !== 'draft') throw new AppError('onlyDraftDeletable');
    tx.update(eRef(eventId), softDeletePayload(actorId));
  });
}
export const restoreEvent = (eventId: string) => updateDoc(eRef(eventId), restorePayload());
export async function getEvent(eventId: string, canSeeDeleted = false): Promise<ClubEvent> {
  const e = fromDoc<ClubEvent>(await getDoc(eRef(eventId)));
  if (!e || (e.isDeleted && !canSeeDeleted)) throw new AppError('notFound');
  return e;
}
const before = (toUtc?: number) => (toUtc ? [where('startsAt', '<', Timestamp.fromMillis(toUtc))] : []);
/** EVT-01: herkese açık etkinlikler (fromUtc'den itibaren; takvim görünümü için isteğe bağlı üst sınır). */
export async function listPublicUpcoming(fromUtc: number, toUtc?: number): Promise<ClubEvent[]> {
  const qs = await getDocs(query(col(C.events), where('visibility', '==', 'public'), where('status', 'in', ['published', 'cancelled']), where('isDeleted', '==', false), where('startsAt', '>=', Timestamp.fromMillis(fromUtc)), ...before(toUtc), orderBy('startsAt', 'asc'), limit(LIMITS.upcomingEventsFetchMax)));
  return fromQuery<ClubEvent>(qs);
}
export async function listMembersUpcoming(clubId: string, fromUtc: number, toUtc?: number): Promise<ClubEvent[]> {
  const qs = await getDocs(query(col(C.events), where('clubId', '==', clubId), where('visibility', '==', 'members'), where('status', 'in', ['published', 'cancelled']), where('isDeleted', '==', false), where('startsAt', '>=', Timestamp.fromMillis(fromUtc)), ...before(toUtc), orderBy('startsAt', 'asc'), limit(LIMITS.upcomingEventsFetchMax)));
  return fromQuery<ClubEvent>(qs);
}
/** Kulübün herkese açık ve (üyeyse) üyelere özel yayınlanmış etkinlikleri — CLB-03. */
export async function listClubPublicEvents(clubId: string, includeMembers: boolean): Promise<ClubEvent[]> {
  const vis = includeMembers ? ['public', 'members'] : ['public'];
  const all = await Promise.all(vis.map(async (v) => fromQuery<ClubEvent>(await getDocs(query(col(C.events), where('clubId', '==', clubId), where('visibility', '==', v), where('status', 'in', ['published', 'cancelled']), where('isDeleted', '==', false), orderBy('startsAt', 'desc'), limit(100))))));
  return all.flat().sort((a, b) => b.startsAt - a.startsAt);
}
/** Yönetici: taslaklar dahil (MGT-04). */
export async function listClubEvents(clubId: string, cursor?: QueryDocumentSnapshot<DocumentData> | null, size = 100): Promise<Page<ClubEvent>> {
  const qs = await getDocs(query(col(C.events), where('clubId', '==', clubId), where('isDeleted', '==', false), orderBy('startsAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(size)));
  return { items: fromQuery<ClubEvent>(qs), cursor: qs.docs[qs.docs.length - 1] || null, hasMore: qs.docs.length === size };
}
export async function getEvents(eventIds: string[]): Promise<ClubEvent[]> {
  const out: ClubEvent[] = [];
  for (const part of chunk(uniq(eventIds), 30)) {
    // her belge tek tek okunur: whereIn(documentId) sorgusu Rules'ta tüm sonuçların okunabilir olmasını ister
    const docs = await Promise.all(part.map((id) => getDoc(eRef(id)).then((s) => fromDoc<ClubEvent>(s)).catch(() => null)));
    docs.forEach((d) => { if (d) out.push(d); });
  }
  return out;
}
export { documentId };
