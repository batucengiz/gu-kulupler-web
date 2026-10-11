import { getDoc, getDocs, query, where, documentId, writeBatch, updateDoc, orderBy, limit, startAfter, collectionGroup, setDoc, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, accountRef, type Page } from '../db';
import { fromDoc, fromQuery, baseCreate, touch, now } from '../fs';
import type { User } from '../models';
import { DEFAULT_SETTINGS } from '../models';
import { chunk, uniq } from '../../lib/util';
import { LIMITS } from '../../lib/constants';

/* --- önbellek: yazar/üye satırları için toplu kullanıcı çekme (whereIn ≤ 30) --- */
const cache = new Map<string, User | null>();
const inflight = new Map<string, Promise<void>>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const waiters: Array<() => void> = [];
const listeners = new Set<() => void>();
export const userCache = {
  get: (id: string) => cache.get(id),
  has: (id: string) => cache.has(id),
  put(u: User) { cache.set(u.id, u); listeners.forEach((l) => l()); },
  invalidate(id: string) { cache.delete(id); },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};
async function flush() {
  timer = null; const batch = [...queue]; queue = new Set();
  const done = waiters.splice(0);
  for (const part of chunk(batch, 30)) {
    const p = (async () => {
      try {
        const qs = await getDocs(query(col(C.users), where(documentId(), 'in', part)));
        const found = new Set<string>();
        qs.docs.forEach((d) => { const u = fromDoc<User>(d)!; cache.set(u.id, u); found.add(u.id); });
        part.forEach((id) => { if (!found.has(id)) cache.set(id, null); });
      } catch (e) { console.warn('kullanıcılar okunamadı', e); part.forEach((id) => { if (!cache.has(id)) cache.set(id, null); }); }
    })();
    part.forEach((id) => inflight.set(id, p));
    await p; part.forEach((id) => inflight.delete(id));
  }
  listeners.forEach((l) => l());
  done.forEach((w) => w());
}
/** Kullanıcıları önbelleğe alır (eksik olanları toplu çeker). */
export function loadUsers(idsIn: (string | null | undefined)[]): Promise<void> {
  const need = uniq(idsIn.filter((x): x is string => !!x)).filter((id) => !cache.has(id) && !inflight.has(id) && !queue.has(id));
  const pending = uniq(idsIn.filter((x): x is string => !!x)).map((id) => inflight.get(id)).filter(Boolean) as Promise<void>[];
  if (!need.length) return Promise.all(pending).then(() => undefined);
  need.forEach((id) => queue.add(id));
  if (!timer) timer = setTimeout(flush, 10);
  return new Promise<void>((resolve) => waiters.push(resolve)).then(() => Promise.all(pending)).then(() => undefined);
}

export async function getUser(uid: string): Promise<User | null> {
  const u = fromDoc<User>(await getDoc(ref(C.users, uid)));
  if (u) cache.set(uid, u);
  return u;
}
export async function getUsers(uids: string[]): Promise<User[]> {
  await loadUsers(uids);
  return uids.map((id) => cache.get(id)).filter((u): u is User => !!u);
}
/** UserRepository.createProfile — users + private/account + settings tek batch. */
export async function createProfile(p: { uid: string; email: string; name: string; nameLower: string; avatarSeed: string }) {
  const b = writeBatch(db);
  b.set(ref(C.users, p.uid), {
    name: p.name, nameLower: p.nameLower, avatarSeed: p.avatarSeed, avatarPath: null, department: null, year: null,
    interests: [], bio: '', status: 'active', suspendReason: null, staff: false, profileComplete: false, ...baseCreate(),
  });
  b.set(accountRef(p.uid), { email: p.email, emailLower: p.email.toLowerCase(), fcmTokens: [], lastLoginAt: null, ...baseCreate() });
  b.set(ref(C.settings, p.uid), { ...DEFAULT_SETTINGS, updatedAt: now() });
  await b.commit();
}
export type UserProfilePatch = Partial<Pick<User, 'name' | 'nameLower' | 'avatarSeed' | 'avatarPath' | 'department' | 'year' | 'interests' | 'bio' | 'profileComplete'>>;
export async function updateProfile(uid: string, patch: UserProfilePatch) {
  await updateDoc(ref(C.users, uid), { ...patch, ...touch() });
  cache.delete(uid);
}
export async function touchLastLogin(uid: string) {
  try { await updateDoc(accountRef(uid), { lastLoginAt: now(), ...touch() }); } catch { /* best-effort */ }
}
export async function ensureAccountDoc(uid: string, email: string) {
  const snap = await getDoc(accountRef(uid));
  if (!snap.exists()) await setDoc(accountRef(uid), { email, emailLower: email.toLowerCase(), fcmTokens: [], lastLoginAt: null, ...baseCreate() });
}
/** event_new ilgi eşleşmeli fan-out (CD-38). */
export async function listByInterests(interestIds: string[], max: number = LIMITS.eventNewInterestFanOutMax): Promise<string[]> {
  if (!interestIds.length) return [];
  const qs = await getDocs(query(col(C.users), where('interests', 'array-contains-any', interestIds.slice(0, 30)), where('isDeleted', '==', false), limit(max)));
  return qs.docs.map((d) => d.id);
}
/** ADM-05 ad önekiyle arama. */
export async function listUsersByName(prefixLower: string, cursor?: QueryDocumentSnapshot<DocumentData> | null): Promise<Page<User>> {
  const parts = [where('isDeleted', '==', false), orderBy('nameLower')];
  const q = prefixLower
    ? query(col(C.users), where('isDeleted', '==', false), where('nameLower', '>=', prefixLower), where('nameLower', '<', prefixLower + ''), orderBy('nameLower'), ...(cursor ? [startAfter(cursor)] : []), limit(LIMITS.pageSize))
    : query(col(C.users), ...parts, ...(cursor ? [startAfter(cursor)] : []), limit(LIMITS.pageSize));
  const qs = await getDocs(q);
  const items = fromQuery<User>(qs); items.forEach((u) => cache.set(u.id, u));
  return { items, cursor: qs.docs[qs.docs.length - 1] || null, hasMore: qs.docs.length === LIMITS.pageSize };
}
/** ADM-05 e-posta araması (collectionGroup private, yalnızca users/*). */
export async function findUserByEmail(emailLower: string): Promise<User[]> {
  if (!emailLower) return [];
  const qs = await getDocs(query(collectionGroup(db, 'private'), where('emailLower', '>=', emailLower), where('emailLower', '<', emailLower + ''), limit(20)));
  const uids = uniq(qs.docs.filter((d) => d.ref.parent.parent?.parent.id === 'users').map((d) => d.ref.parent.parent!.id));
  return getUsers(uids);
}
export async function getMyEmail(uid: string): Promise<string | null> {
  const s = await getDoc(accountRef(uid)); return s.exists() ? (s.data().email as string) : null;
}
