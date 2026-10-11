import { collection, doc, type DocumentReference, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const C = {
  users: 'users', clubs: 'clubs', memberships: 'memberships', posts: 'posts', comments: 'comments', events: 'events', rsvps: 'rsvps',
  notifications: 'notifications', reports: 'reports', activity: 'activity', settings: 'settings', blocks: 'blocks', savedPosts: 'savedPosts',
  supportTickets: 'supportTickets', announcementCounters: 'announcementCounters',
} as const;
export const col = (name: string) => collection(db, name);
export const ref = (path: string, ...segments: string[]): DocumentReference => doc(db, path, ...segments);
/** FirestoreIds */
export const ids = {
  membership: (c: string, u: string) => `${c}_${u}`,
  rsvp: (e: string, u: string) => `${e}_${u}`,
  block: (a: string, b: string) => `${a}_${b}`,
  savedPost: (u: string, p: string) => `${u}_${p}`,
  report: (r: string, type: string, id: string) => `${r}_${type}_${id}`,
  announcementCounter: (c: string, dayKey: string) => `${c}_${dayKey}`,
  notification: (type: string, refId: string, u: string) => `${type}_${refId}_${u}`,
};
export const accountRef = (uid: string) => doc(db, C.users, uid, 'private', 'account');
export const contactRef = (mid: string) => doc(db, C.memberships, mid, 'private', 'contact');

export interface Page<T> { items: T[]; cursor: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }
