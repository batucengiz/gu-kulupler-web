import { getDoc, getDocs, setDoc, query, where, orderBy, limit, startAfter, writeBatch, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, ids, type Page } from '../db';
import { fromQuery, fromDoc, baseCreate, now, AppError, touch } from '../fs';
import type { Report } from '../models';
import { addNotification } from './notifications';
import { LIMITS } from '../../lib/constants';
import { chunk } from '../../lib/util';

export interface ReportTarget { type: Report['targetType']; id: string; clubId?: string | null }
export async function report(reporterId: string, target: ReportTarget, reason: string, note = '') {
  const r = ref(C.reports, ids.report(reporterId, target.type, target.id));
  try {
    const s = await getDoc(r);
    if (s.exists()) throw new AppError('alreadyExists');
  } catch (e) { if (e instanceof AppError) throw e; /* okunamadıysa create dener */ }
  try {
    await setDoc(r, { targetType: target.type, targetId: target.id, targetClubId: target.clubId || null, reporterId, reason, note: note.trim(), status: 'open', action: null, resolvedAt: null, resolvedBy: null, ...baseCreate() });
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') throw new AppError('alreadyExists');
    throw e;
  }
}
export async function hasReported(reporterId: string, target: ReportTarget) {
  try { return (await getDoc(ref(C.reports, ids.report(reporterId, target.type, target.id)))).exists(); } catch { return false; }
}
export async function listReports(status: 'open' | 'resolved', cursor?: QueryDocumentSnapshot<DocumentData> | null, size = 100): Promise<Page<Report>> {
  const qs = await getDocs(query(col(C.reports), where('status', '==', status), orderBy('createdAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(size)));
  return { items: fromQuery<Report>(qs), cursor: qs.docs[qs.docs.length - 1] || null, hasMore: qs.docs.length === size };
}
/** Süper yönetici: tek bildirim (bildirimden açılan SHT-26 için). */
export async function getReport(id: string): Promise<Report | null> { return fromDoc<Report>(await getDoc(ref(C.reports, id))); }
export async function listReportsForTarget(type: string, targetId: string): Promise<Report[]> {
  return fromQuery<Report>(await getDocs(query(col(C.reports), where('targetType', '==', type), where('targetId', '==', targetId), where('status', '==', 'open'))));
}
export interface ReportGroup { key: string; targetType: Report['targetType']; targetId: string; targetClubId: string | null; reports: Report[]; latest: number }
export function groupReports(list: Report[]): ReportGroup[] {
  const m = new Map<string, ReportGroup>();
  for (const r of list) {
    const k = `${r.targetType}_${r.targetId}`;
    const g = m.get(k) || { key: k, targetType: r.targetType, targetId: r.targetId, targetClubId: r.targetClubId, reports: [], latest: 0 };
    g.reports.push(r); g.latest = Math.max(g.latest, r.createdAt); m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.latest - a.latest);
}
/** AdminRepository.resolveReports — tek batch (≤450 yazım; aşarsa parçalı). */
export async function resolveReports(group: ReportGroup, action: 'removed' | 'dismissed' | 'suspended', actorId: string) {
  const open = group.reports.filter((r) => r.status === 'open');
  const extra: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
  if (action === 'removed' && (group.targetType === 'post' || group.targetType === 'comment')) {
    extra.push((b) => b.update(ref(group.targetType === 'post' ? C.posts : C.comments, group.targetId), { isHidden: true, hiddenBy: actorId, hiddenAt: now(), ...touch() }));
  }
  if (action === 'suspended' && group.targetType === 'user') extra.push((b) => b.update(ref(C.users, group.targetId), { status: 'suspended', suspendReason: 'report', ...touch() }));
  if (action === 'suspended' && group.targetType === 'club') extra.push((b) => b.update(ref(C.clubs, group.targetId), { status: 'suspended', suspendReason: 'report', ...touch() }));
  const parts = chunk(open, Math.floor((LIMITS.batchMaxWrites - extra.length) / 2));
  for (let i = 0; i < parts.length; i++) {
    const b = writeBatch(db);
    if (i === 0) extra.forEach((f) => f(b));
    for (const r of parts[i]) {
      b.update(ref(C.reports, r.id), { status: 'resolved', action, resolvedAt: now(), resolvedBy: actorId, ...touch() });
      addNotification(b, { type: 'report_resolved', refs: { reportId: r.id } }, r.reporterId);
    }
    await b.commit();
  }
}
