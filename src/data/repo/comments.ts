/* CommentRepository — sayaç eşliği lastCommentRef (CD-41). */
import { doc, collection, getDoc, onSnapshot, query, where, orderBy, writeBatch, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col, ref } from '../db';
import { fromDoc, fromQuery, baseCreate, softDeletePayload, restorePayload, touch, AppError } from '../fs';
import type { Comment } from '../models';

export async function addComment(p: { postId: string; clubId: string; authorId: string; text: string }): Promise<string> {
  const r = doc(collection(db, C.comments));
  const b = writeBatch(db);
  b.set(r, { postId: p.postId, clubId: p.clubId, authorId: p.authorId, text: p.text.trim(), isHidden: false, ...baseCreate() });
  b.update(ref(C.posts, p.postId), { commentCount: increment(1), lastCommentRef: `comments/${r.id}`, ...touch() });
  await b.commit();
  return r.id;
}
export async function softDeleteComment(commentId: string, postId: string, actorId: string) {
  const b = writeBatch(db);
  b.update(ref(C.comments, commentId), softDeletePayload(actorId));
  b.update(ref(C.posts, postId), { commentCount: increment(-1), lastCommentRef: `comments/${commentId}`, ...touch() });
  await b.commit();
}
export async function restoreComment(commentId: string, postId: string) {
  const b = writeBatch(db);
  b.update(ref(C.comments, commentId), restorePayload());
  b.update(ref(C.posts, postId), { commentCount: increment(1), lastCommentRef: `comments/${commentId}`, ...touch() });
  await b.commit();
}
export function watchComments(postId: string, clubId: string, cb: (list: Comment[]) => void, onErr?: (e: unknown) => void) {
  return onSnapshot(
    query(col(C.comments), where('postId', '==', postId), where('clubId', '==', clubId), where('isDeleted', '==', false), where('isHidden', '==', false), orderBy('createdAt', 'asc')),
    (qs) => cb(fromQuery<Comment>(qs)), (e) => { console.warn('yorum akışı', e); onErr?.(e); },
  );
}
export async function getComment(commentId: string, isSuper = false): Promise<Comment> {
  const c = fromDoc<Comment>(await getDoc(ref(C.comments, commentId)));
  if (!c || (!isSuper && (c.isDeleted || c.isHidden))) throw new AppError('notFound');
  return c;
}
