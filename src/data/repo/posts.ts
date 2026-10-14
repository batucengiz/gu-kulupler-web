/* PostRepository + AnnouncementCounterRepository — PLAN §10.4 (T-19). */
import { doc, collection, getDoc, getDocs, onSnapshot, query, where, orderBy, limit, startAfter, runTransaction, updateDoc, setDoc, arrayUnion, arrayRemove, increment, getCountFromServer, Timestamp, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref, ids, type Page } from '../db';
import { fromDoc, fromQuery, baseCreate, touch, now, softDeletePayload, restorePayload, AppError, errCode } from '../fs';
import type { Post, PostImage, PostType, Club } from '../models';
import { addActivity, activityId } from './activity';
import { fanOut } from './notifications';
import { listAllActive } from './memberships';
import { LIMITS } from '../../lib/constants';
import { istanbulDay, istanbulStartOfDay, DAY } from '../../lib/util';

export interface PollDraft { options: string[]; durationDays: 1 | 3 | 7; showResultsAfterVote: boolean }
export interface PostDraft { type: PostType; title?: string | null; text: string; images: PostImage[]; poll?: PollDraft | null; pushSent: boolean }
export interface AnnouncementCounter { id: string; clubId: string; day: string; count: number; lastPostRef: string | null }

export const newPostId = () => doc(collection(db, C.posts)).id;
const postRef = (id: string) => ref(C.posts, id);

/* ---------- duyuru sayacı ---------- */
const counterRef = (clubId: string, key: string) => ref(C.announcementCounters, ids.announcementCounter(clubId, key));
/** Gün sınırına clockSkewTolerance kadar yakınsa komşu günün anahtarı (CD-129). */
function adjacentDay(nowUtc: number): { key: string; iso: string } | null {
  const start = istanbulStartOfDay(nowUtc);
  if (nowUtc - start < LIMITS.clockSkewToleranceMs) return istanbulDay(start - 1);
  if (start + DAY - nowUtc < LIMITS.clockSkewToleranceMs) return istanbulDay(start + DAY);
  return null;
}
export async function getTodayCount(clubId: string): Promise<number> {
  const t = Date.now(); const keys = [istanbulDay(t).key];
  const adj = adjacentDay(t); if (adj) keys.push(adj.key);
  let max = 0;
  for (const k of keys) {
    try { const s = await getDoc(counterRef(clubId, k)); if (s.exists()) max = Math.max(max, (s.data().count as number) || 0); } catch { /* okunamazsa 0 */ }
  }
  return max;
}
export const remainingToday = async (clubId: string) => Math.max(0, LIMITS.announcementDailyLimit - (await getTodayCount(clubId)));

/* ---------- oluştur / düzenle ---------- */
function buildPost(draft: PostDraft, authorId: string, clubId: string) {
  // null alanların anahtarı yazılmaz (W-51): title yalnızca duyuruda, poll yalnızca ankette
  const data: Record<string, unknown> = { clubId, authorId, type: draft.type };
  if (draft.type === 'announcement') data.title = (draft.title || '').trim();
  data.text = draft.text.trim();
  data.images = draft.images;
  if (draft.type === 'poll' && draft.poll) data.poll = {
    options: draft.poll.options.map((text, i) => ({ id: `o${i + 1}`, text: text.trim() })),
    endsAt: Timestamp.fromMillis(Date.now() + draft.poll.durationDays * DAY),
    showResultsAfterVote: draft.poll.showResultsAfterVote,
  };
  Object.assign(data, { pinned: false, pushSent: !!draft.pushSent && draft.type === 'announcement', likes: [], likeCount: 0, commentCount: 0, isHidden: false, ...baseCreate() });
  return data as { clubId: string; authorId: string; type: PostType; pushSent: boolean } & Record<string, unknown>;
}
const activityKind = (type: PostType) => (type === 'post' ? 'post_created' : type);
/** Tek işlem: (bildirimli duyuruda günün sayacı okunur, +1) + gönderi + günlük (sabit kimlik). */
async function commitCreate(postId: string, data: ReturnType<typeof buildPost>, day: { key: string; iso: string } | null) {
  await runTransaction(db, async (tx) => {
    if (day) {
      const s = await tx.get(counterRef(data.clubId, day.key));
      const prevCount = s.exists() ? (s.data().count as number) || 0 : 0;
      if (prevCount >= LIMITS.announcementDailyLimit) throw new AppError('announcementLimit');
      tx.set(counterRef(data.clubId, day.key), { clubId: data.clubId, day: day.iso, count: prevCount + 1, lastPostRef: `posts/${postId}`, updatedAt: now() }, { merge: true });
    }
    tx.set(postRef(postId), data);
    const kind = activityKind(data.type);
    addActivity(tx, { clubId: data.clubId, actorId: data.authorId, kind, refs: { postId }, id: activityId(data.clubId, data.authorId, kind, postId) });
  });
}
/** create + (duyuru+push ise) fan-out — ManagementRepository.publishPost. */
export async function publishPost(draft: PostDraft, p: { clubId: string; authorId: string; postId: string; advisorUserId?: string | null }): Promise<string> {
  const data = buildPost(draft, p.authorId, p.clubId);
  if (data.pushSent) {
    const t = Date.now(); const day = istanbulDay(t);
    try { await commitCreate(p.postId, data, day); }
    catch (e) {
      // cihaz saati gün sınırına yakınsa komşu günle bir kez daha (CD-129)
      const adj = adjacentDay(t);
      if (errCode(e) === 'permission-denied' && adj) await commitCreate(p.postId, data, adj);
      else throw e;
    }
    try {
      const members = (await listAllActive(p.clubId)).filter((m) => m.role !== 'advisor').map((m) => m.userId);
      await fanOut({ type: 'announcement', refs: { clubId: p.clubId, postId: p.postId } }, members.filter((u) => u !== p.advisorUserId), p.authorId);
    } catch (e) { console.warn('[fan-out] announcement', e); }
  } else {
    await commitCreate(p.postId, data, null);
  }
  return p.postId;
}
export interface PostEditPatch { text: string; title?: string | null; images: PostImage[] }
/** Yalnızca verilen alanlar + editedAt (başlık yalnızca duyuruda). */
export async function updatePost(postId: string, patch: PostEditPatch) {
  await updateDoc(postRef(postId), { text: patch.text.trim(), ...(patch.title !== undefined && patch.title !== null ? { title: patch.title.trim() } : {}), images: patch.images, editedAt: now(), ...touch() });
}
/** Soft delete (tek işlem): sabitse aynı yazımda pinned false + kulüp pinnedPostId null. */
export async function softDeletePost(postId: string, actorId: string, clubId: string) {
  await runTransaction(db, async (tx) => {
    const post = fromDoc<Post>(await tx.get(postRef(postId)));
    if (!post || post.isDeleted) throw new AppError('conflict');
    if (post.pinned) {
      tx.update(postRef(postId), { ...softDeletePayload(actorId), pinned: false });
      tx.update(ref(C.clubs, clubId), { pinnedPostId: null, ...touch() });
    } else tx.update(postRef(postId), softDeletePayload(actorId));
  });
}
export const restorePost = (postId: string) => updateDoc(postRef(postId), restorePayload());
/** Tek işlem: kulüp + gönderi (+ eski sabit) okunur; eski false, yeni true, işaretçi yeni gönderi. */
export async function pin(postId: string, clubId: string) {
  await runTransaction(db, async (tx) => {
    const club = fromDoc<Club>(await tx.get(ref(C.clubs, clubId)));
    const post = fromDoc<Post>(await tx.get(postRef(postId)));
    const prevId = club?.pinnedPostId && club.pinnedPostId !== postId ? club.pinnedPostId : null;
    const prev = prevId ? await tx.get(postRef(prevId)) : null;
    if (!post || post.isDeleted || post.isHidden) throw new AppError('conflict');
    if (prev && prev.exists()) tx.update(postRef(prevId!), { pinned: false, ...touch() });
    tx.update(postRef(postId), { pinned: true, ...touch() });
    tx.update(ref(C.clubs, clubId), { pinnedPostId: postId, ...touch() });
  });
}
export async function unpin(postId: string, clubId: string) {
  await runTransaction(db, async (tx) => {
    const club = fromDoc<Club>(await tx.get(ref(C.clubs, clubId)));
    tx.update(postRef(postId), { pinned: false, ...touch() });
    if (club?.pinnedPostId === postId) tx.update(ref(C.clubs, clubId), { pinnedPostId: null, ...touch() });
  });
}
/** Beğeni: updatedAt yazılmaz (CD-131). */
export const like = (postId: string, uid: string) => updateDoc(postRef(postId), { likes: arrayUnion(uid), likeCount: increment(1) });
export const unlike = (postId: string, uid: string) => updateDoc(postRef(postId), { likes: arrayRemove(uid), likeCount: increment(-1) });

/* ---------- anket ---------- */
const voteRef = (postId: string, uid: string) => doc(db, C.posts, postId, 'votes', uid);
export async function vote(postId: string, uid: string, optionId: string) {
  const s = await getDoc(voteRef(postId, uid));
  if (s.exists()) throw new AppError('alreadyExists');
  try { await setDoc(voteRef(postId, uid), { optionId, createdAt: now() }); }
  catch (e) { if (errCode(e) === 'permission-denied') { const again = await getDoc(voteRef(postId, uid)); if (again.exists()) throw new AppError('alreadyExists'); } throw e; }
}
export async function myVote(postId: string, uid: string): Promise<string | null> {
  const s = await getDoc(voteRef(postId, uid)); return s.exists() ? (s.data().optionId as string) : null;
}
export async function countVotes(postId: string, optionIds: string[]): Promise<Record<string, number>> {
  const vc = collection(db, C.posts, postId, 'votes');
  const counts = await Promise.all(optionIds.map((o) => getCountFromServer(query(vc, where('optionId', '==', o)))));
  return Object.fromEntries(optionIds.map((o, i) => [o, counts[i].data().count]));
}

/* ---------- okuma ---------- */
export async function listFeed(clubId: string, cursor?: QueryDocumentSnapshot<DocumentData> | null, size: number = LIMITS.pageSize): Promise<Page<Post>> {
  const qs = await getDocs(query(col(C.posts), where('clubId', '==', clubId), where('isDeleted', '==', false), where('isHidden', '==', false), orderBy('createdAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(size)));
  return { items: fromQuery<Post>(qs), cursor: qs.docs[qs.docs.length - 1] || null, hasMore: qs.docs.length === size };
}
export async function listForManagement(clubId: string, cursor?: QueryDocumentSnapshot<DocumentData> | null, size: number = LIMITS.pageSize): Promise<Page<Post>> {
  const qs = await getDocs(query(col(C.posts), where('clubId', '==', clubId), where('isDeleted', '==', false), orderBy('createdAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(size)));
  return { items: fromQuery<Post>(qs), cursor: qs.docs[qs.docs.length - 1] || null, hasMore: qs.docs.length === size };
}
/** SYS-04: silinmiş/gizli gönderi yetkisiz için notFound. */
export async function getPost(postId: string, viewer?: { uid: string; isManager: boolean; isSuper: boolean }): Promise<Post> {
  let p: Post | null;
  try { p = fromDoc<Post>(await getDoc(postRef(postId))); }
  catch (e) { if (errCode(e) === 'permission-denied') throw new AppError('forbidden'); throw e; }
  if (!p) throw new AppError('notFound');
  const priv = viewer && (viewer.isSuper || viewer.isManager || viewer.uid === p.authorId);
  if ((p.isDeleted || p.isHidden) && !(viewer?.isSuper || (priv && !p.isDeleted))) throw new AppError('notFound');
  return p;
}
export function watchPost(postId: string, cb: (p: Post | null) => void, onErr?: (e: unknown) => void) {
  return onSnapshot(postRef(postId), (s) => cb(fromDoc<Post>(s)), (e) => { console.warn('gönderi akışı', e); onErr?.(e); });
}
