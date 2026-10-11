/* Ekran yükleyicileri — her biri bir anahtar + veri aynasına yazan bir işlev döndürür (useLoad ile kullanılır).
   Rules sözleşmesi (docs/firestore-rules-spec.md §6) gereği sorgular kulüp/durum süzgeçlerini taşır. */
import { useEffect } from 'react';
import { db, useLoad } from './data';
import { watchPost } from '../data/repo/posts';
import { watchComments } from '../data/repo/comments';
import { session } from './session';
import * as M from '../data/repo/memberships';
import * as E from '../data/repo/events';
import * as R from '../data/repo/rsvps';
import { loadUsers } from '../data/repo/users';
import { fetchActiveClubs } from '../data/repo/clubs';
import { LIMITS } from '../lib/constants';
import type { Membership } from '../data/models';

export interface Loader { key: string; fn: () => Promise<unknown> }
const L = (key: string, fn: () => Promise<unknown>): Loader => ({ key, fn });
const users = (ms: Array<{ userId: string }>) => loadUsers(ms.map((m) => m.userId));

export const clubsLoader = () => L('clubs', async () => db.putClubs(await fetchActiveClubs()));

/** Kulüp yönetimi (başkan + yönetim kurulu). İçeriden değilse yalnızca başkan (kullanıcı belgesi herkese açık). */
export const boardLoader = (clubId: string, inside: boolean, presidentId?: string | null) =>
  L(`members:${clubId}:board:${inside ? 1 : 0}`, async () => {
    if (inside) { const ms = await M.listManagers(clubId); db.putMemberships(ms); await users(ms); }
    else if (presidentId) await loadUsers([presidentId]);
  });

/** Üye listesi (sayfalı) — CLB-03 önizleme ve CLB-06. */
export const membersLoader = (clubId: string, size: number = LIMITS.pageSize) =>
  L(`members:${clubId}:list`, async () => {
    const p = await M.listActiveMembers(clubId, null, undefined, size);
    db.putMemberships(p.items); db.setExtra('membersPage:' + clubId, { ids: p.items.map((m) => m.id), cursor: p.cursor, hasMore: p.hasMore });
    await users(p.items);
  });
export async function loadMoreMembers(clubId: string) {
  const cur = db.extra['membersPage:' + clubId]; if (!cur || !cur.hasMore) return;
  const p = await M.listActiveMembers(clubId, cur.cursor);
  db.putMemberships(p.items); db.setExtra('membersPage:' + clubId, { ids: [...cur.ids, ...p.items.map((m) => m.id)], cursor: p.cursor, hasMore: p.hasMore });
  await users(p.items);
}
export const memberPageList = (clubId: string): Array<Membership & { user: any }> => {
  const cur = db.extra['membersPage:' + clubId];
  const list = cur ? cur.ids.map((id: string) => db.memberships[id]) : [];
  return list.filter((m: Membership | undefined) => m && m.status === 'active').map((m: Membership) => ({ ...m, user: null }));
};

/** Tüm aktif üyeler (yönetici ekranları, devir/rol seçimi). */
export const allMembersLoader = (clubId: string) =>
  L(`members:${clubId}:all`, async () => { const ms = await M.listAllActive(clubId); db.putMemberships(ms); await users(ms); });

/** Başvurular (yönetici) — bekleyen + son kararlar. */
export const appsLoader = (clubId: string) =>
  L(`apps:${clubId}`, async () => {
    const [pending, rejected] = await Promise.all([M.listByStatus(clubId, 'pending'), M.listByStatus(clubId, 'rejected')]);
    db.putMemberships([...pending.items, ...rejected.items]);
    await users([...pending.items, ...rejected.items]);
  });

/** CLB-03 Etkinlikler sekmesi. */
export const clubPublicEventsLoader = (clubId: string, inside: boolean) =>
  L(`clubEvents:${clubId}:pub:${inside ? 1 : 0}`, async () => db.putEvents(await E.listClubPublicEvents(clubId, inside)));

/** Yönetici: taslaklar dahil tüm etkinlikler. */
export const clubEventsLoader = (clubId: string) =>
  L(`clubEvents:${clubId}:all`, async () => db.putEvents((await E.listClubEvents(clubId)).items));

/** EVT-01 / arama: herkese açık yaklaşan etkinlikler + üye olduğum kulüplerin üyelere özel etkinlikleri. */
export const upcomingLoader = () =>
  L('events:upcoming', async () => {
    const from = Date.now() - 12 * 36e5;
    const mine = Object.values(session.s.memberships).filter((m) => m.status === 'active').map((m) => m.clubId);
    const [pub, ...mem] = await Promise.all([E.listPublicUpcoming(from), ...mine.map((c) => E.listMembersUpcoming(c, from).catch(() => []))]);
    db.putEvents([...pub, ...mem.flat()]);
  });

/** EVT-01 takvim görünümü: ayın etkinlikleri (geçmiş günler dahil). */
export const monthLoader = (monthStart: number) =>
  L('events:month:' + monthStart, async () => {
    const d = new Date(monthStart); d.setMonth(d.getMonth() + 1);
    const to = d.getTime();
    const mine = Object.values(session.s.memberships).filter((m) => m.status === 'active').map((m) => m.clubId);
    const [pub, ...mem] = await Promise.all([E.listPublicUpcoming(monthStart, to), ...mine.map((c) => E.listMembersUpcoming(c, monthStart, to).catch(() => []))]);
    db.putEvents([...pub, ...mem.flat()]);
  });

/** EVT-04 / PRF: kaydolduğum etkinliklerin belgeleri. */
export const myEventsLoader = () =>
  L('events:mine', async () => {
    await session.reloadRsvps();
    const ids = Object.keys(session.s.rsvps).filter((id) => !db.events[id]);
    if (ids.length) db.putEvents(await E.getEvents(ids));
  });

/** Tek etkinlik (EVT-02/03). */
export const eventLoader = (eventId: string) =>
  L(`event:${eventId}`, async () => { db.putEvents([await E.getEvent(eventId, true)]); });

/** Katılımcılar (yönetici MGT-06). */
export const participantsLoader = (eventId: string, clubId: string) =>
  L(`participants:${eventId}`, async () => {
    const list = await R.listParticipants(eventId, clubId);
    db.putRsvps(list); await loadUsers(list.map((r) => r.userId));
  });

/** useLoad'un Loader sürümü: `const { status, reload } = useLoader(membersLoader(id))`. */
export const useLoader = (l: Loader | null) => useLoad(l ? l.key : null, l ? l.fn : () => Promise.resolve());
/** Tek kulüp (askıdaki kulüp de okunur). */
export const clubLoader = (clubId: string) => L(`club:${clubId}`, async () => { const { getClub } = await import('../data/repo/clubs'); db.putClubs([await getClub(clubId)]); });

/** CLB-07: ortak kulüpler (ben de aktif üyeysem karşı tarafın aktif üyeliği okunabilir) + bağlam kulübündeki üyelik + e-posta (yönetici/süper). */
export const profileLoader = (otherId: string, ctxClubId?: string | null) =>
  L(`profile:${otherId}:${ctxClubId || ''}`, async () => {
    const mine = Object.values(session.s.memberships).filter((m) => m.status === 'active').map((m) => m.clubId);
    const clubIds = [...new Set([...mine, ...(ctxClubId ? [ctxClubId] : [])])];
    const found = await Promise.all(clubIds.map((c) => M.getMembership(c, otherId).catch(() => null)));
    db.putMemberships(found.filter((x): x is Membership => !!x));
    await loadUsers([otherId]);
    let email: string | null = null;
    const ctxM = ctxClubId ? found[clubIds.indexOf(ctxClubId)] : null;
    const myRole = ctxClubId ? session.s.memberships[ctxClubId] : null;
    const canMgmt = !!myRole && myRole.status === 'active' && ['board', 'president', 'advisor'].includes(myRole.role);
    if (ctxClubId && ctxM && canMgmt) email = await M.readContact(ctxClubId, otherId);
    if (!email && session.s.isSuper) { const { getMyEmail } = await import('../data/repo/users'); email = await getMyEmail(otherId).catch(() => null); }
    db.setExtra('email:' + otherId, email);
  });

/** NTF-01: bildirimlerin başlık/metinleri için başvurulan kulüp, etkinlik, gönderi ve kullanıcıları getir (eksik olanları). */
export async function loadNotifRefs(list: Array<{ refs?: Record<string, string> }>) {
  const pick = (k: string) => [...new Set(list.map((n) => (n.refs || {})[k]).filter(Boolean) as string[])];
  const { getClubs } = await import('../data/repo/clubs');
  const { getPost } = await import('../data/repo/posts');
  const clubIds = pick('clubId').filter((id) => !db.clubs[id]);
  const eventIds = pick('eventId').filter((id) => !db.events[id]);
  const postIds = pick('postId').filter((id) => !db.posts[id] && !tried.has(id));
  postIds.forEach((id) => tried.add(id));
  await Promise.all([
    clubIds.length ? getClubs(clubIds).then((cs) => db.putClubs(cs)).catch(() => {}) : null,
    eventIds.length ? E.getEvents(eventIds).then((es) => db.putEvents(es)).catch(() => {}) : null,
    ...postIds.map((id) => getPost(id).then((p) => db.putPosts([p])).catch(() => {})),
    loadUsers(pick('applicantId')),
  ]);
}
const tried = new Set<string>();

/** FED-02: gönderi ve yorumları canlı dinle (aynaya yazar). Dönen değer: 'loading' | 'ok' | 'missing' | 'error'. */
export function usePostLive(postId: string, clubId: string) {
  useEffect(() => {
    if (!postId || !clubId) return;
    db.setExtra('postLive:' + postId, db.posts[postId] ? 'ok' : 'loading');
    const offP = watchPost(postId, (p) => {
      if (p) { db.putPosts([p]); void loadUsers([p.authorId]); }
      db.setExtra('postLive:' + postId, p ? 'ok' : 'missing');
    }, () => db.setExtra('postLive:' + postId, 'error'));
    const offC = watchComments(postId, clubId, (list) => {
      db.comments[postId] = list; db.changed(); void loadUsers(list.map((c) => c.authorId));
    });
    return () => { offP(); offC(); };
  }, [postId, clubId]);
  return (db.extra['postLive:' + postId] as string) || 'loading';
}
