/* SavedPostRepository */
import { getDoc, getDocs, query, where, orderBy, limit, startAfter, setDoc, updateDoc, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { C, col, ref, ids, type Page } from '../db';
import { fromDoc, fromQuery, baseCreate, now, softDeletePayload, restorePayload } from '../fs';
import type { SavedPost } from '../models';
import { LIMITS } from '../../lib/constants';

const sRef = (u: string, p: string) => ref(C.savedPosts, ids.savedPost(u, p));
export async function savePost(userId: string, postId: string, clubId: string) {
  const s = fromDoc<SavedPost>(await getDoc(sRef(userId, postId)));
  if (!s) await setDoc(sRef(userId, postId), { userId, postId, clubId, savedAt: now(), ...baseCreate() });
  else if (s.isDeleted) await updateDoc(sRef(userId, postId), { ...restorePayload(), savedAt: now() });
}
export const unsavePost = (userId: string, postId: string) => updateDoc(sRef(userId, postId), softDeletePayload(userId));
export const restoreSaved = (userId: string, postId: string) => updateDoc(sRef(userId, postId), restorePayload());
export async function listSaved(userId: string, cursor?: QueryDocumentSnapshot<DocumentData> | null, size: number = LIMITS.pageSize): Promise<Page<SavedPost>> {
  const qs = await getDocs(query(col(C.savedPosts), where('userId', '==', userId), where('isDeleted', '==', false), orderBy('savedAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(size)));
  return { items: fromQuery<SavedPost>(qs), cursor: qs.docs[qs.docs.length - 1] || null, hasMore: qs.docs.length === size };
}
export async function listAllSavedIds(userId: string): Promise<Set<string>> {
  const qs = await getDocs(query(col(C.savedPosts), where('userId', '==', userId), where('isDeleted', '==', false), orderBy('savedAt', 'desc'), limit(500)));
  return new Set(fromQuery<SavedPost>(qs).map((s) => s.postId));
}
export async function isSaved(userId: string, postId: string) {
  const s = fromDoc<SavedPost>(await getDoc(sRef(userId, postId))); return !!s && !s.isDeleted;
}
