import { getDocs, query, where, orderBy, limit, startAfter, getCountFromServer, doc, collection, type WriteBatch, type Transaction, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, type Page } from '../db';
import { fromQuery, now } from '../fs';
import type { Activity } from '../models';
import { LIMITS, kindsOfCategory } from '../../lib/constants';

export interface ActivityDraft { clubId: string; actorId: string; kind: string; refs?: Record<string, string> }
/** ActivityRepository.addToBatch — iş yazımıyla aynı batch/transaction. */
export function addActivity(w: WriteBatch | Transaction, a: ActivityDraft) {
  const r = doc(collection(db, C.activity));
  (w as WriteBatch).set(r, { clubId: a.clubId, actorId: a.actorId, kind: a.kind, refs: a.refs || {}, createdAt: now() });
}
export async function listActivity(clubId: string, category: string | null, cursor?: QueryDocumentSnapshot<DocumentData> | null): Promise<Page<Activity>> {
  const cons = [where('clubId', '==', clubId), ...(category ? [where('kind', 'in', kindsOfCategory(category))] : []), orderBy('createdAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(LIMITS.pageSize)];
  const qs = await getDocs(query(col(C.activity), ...cons));
  return { items: fromQuery<Activity>(qs), cursor: qs.docs[qs.docs.length - 1] || null, hasMore: qs.docs.length === LIMITS.pageSize };
}
/** MGT-01 grafiği (CD-46). */
export async function listKinds(clubId: string, kinds: string[], fromUtc: number): Promise<Activity[]> {
  const { Timestamp } = await import('firebase/firestore');
  const qs = await getDocs(query(col(C.activity), where('clubId', '==', clubId), where('kind', 'in', kinds), where('createdAt', '>=', Timestamp.fromMillis(fromUtc)), orderBy('createdAt', 'desc')));
  return fromQuery<Activity>(qs);
}
/** ADM-01 grafiği: hafta başına count() (yalnızca süper admin). */
export async function countByWeek(kinds: string[], weekStarts: number[]): Promise<number[]> {
  const { Timestamp } = await import('firebase/firestore');
  return Promise.all(weekStarts.map(async (w0, i) => {
    const w1 = weekStarts[i + 1] ?? w0 + 7 * 864e5;
    const s = await getCountFromServer(query(col(C.activity), where('kind', 'in', kinds), where('createdAt', '>=', Timestamp.fromMillis(w0)), where('createdAt', '<', Timestamp.fromMillis(w1))));
    return s.data().count;
  }));
}
