import { getDoc, getDocs, query, where, documentId, limit } from 'firebase/firestore';
import { C, col, ref } from '../db';
import { fromDoc, fromQuery, AppError } from '../fs';
import type { Club } from '../models';
import { chunk } from '../../lib/util';
import { LIMITS } from '../../lib/constants';

export async function fetchActiveClubs(): Promise<Club[]> {
  const qs = await getDocs(query(col(C.clubs), where('isDeleted', '==', false), limit(LIMITS.clubsFetchMax * 4)));
  return fromQuery<Club>(qs).sort((a, b) => a.nameLower.localeCompare(b.nameLower, 'tr'));
}
export async function getClub(id: string): Promise<Club> {
  const c = fromDoc<Club>(await getDoc(ref(C.clubs, id)));
  if (!c || c.isDeleted) throw new AppError('notFound');
  return c;
}
export async function getClubs(idsIn: string[]): Promise<Club[]> {
  const out: Club[] = [];
  for (const part of chunk(idsIn, 30)) {
    if (!part.length) continue;
    const qs = await getDocs(query(col(C.clubs), where(documentId(), 'in', part), where('isDeleted', '==', false)));
    out.push(...fromQuery<Club>(qs));
  }
  return out;
}
export async function isNameTaken(nameLower: string, exceptId?: string): Promise<boolean> {
  const qs = await getDocs(query(col(C.clubs), where('nameLower', '==', nameLower), limit(2)));
  return qs.docs.some((d) => d.id !== exceptId);
}
