/* Seçiciler — prototipteki `app.sel` API'si; veriyi oturumdan ve veri aynasından eşzamanlı okur.
   Eksik belge istendiğinde arka planda yüklenir; yüklenince tüm ağaç yeniden çizilir. */
import { db } from './data';
import { session } from './session';
import { userCache, loadUsers } from '../data/repo/users';
import { getClub } from '../data/repo/clubs';
import { getEvent } from '../data/repo/events';
import type { Club, ClubEvent, Membership, Post, Rsvp, User, Settings, ClubPrefs, AppNotification, Access } from '../data/models';
import { DEFAULT_SETTINGS, DEFAULT_CLUB_PREFS } from '../data/models';
import { LIMITS } from '../lib/constants';
import { istanbulDay } from '../lib/util';

const me = () => session.s.uid;
const requested = new Set<string>();
function want(key: string, fn: () => Promise<unknown>) { if (requested.has(key)) return; requested.add(key); fn().catch(() => undefined).finally(() => setTimeout(() => requested.delete(key), 30_000)); }

export const sel = {
  me: (): User | null => session.s.user,
  club(id: string | null | undefined): Club | null {
    if (!id) return null; const c = db.clubs[id];
    if (!c) want('club:' + id, async () => { const x = await getClub(id); db.putClubs([x]); });
    return c || null;
  },
  user(id: string | null | undefined): User | null {
    if (!id) return null;
    if (id === me() && session.s.user) return session.s.user;
    const u = userCache.get(id); if (u === undefined) void loadUsers([id]); return u || null;
  },
  event(id: string | null | undefined): ClubEvent | null {
    if (!id) return null; const e = db.events[id];
    if (!e) want('event:' + id, async () => { const x = await getEvent(id, true); db.putEvents([x]); });
    return e || null;
  },
  post: (id: string | null | undefined): Post | null => (id ? db.posts[id] || null : null),
  membership(clubId: string, u: string | null | undefined): Membership | null {
    if (!u) return null;
    if (u === me()) return session.s.memberships[clubId] || null;
    return db.memberships[`${clubId}_${u}`] || null;
  },
  roleIn(clubId: string, u: string | null | undefined) { const m = sel.membership(clubId, u); return m && m.status === 'active' ? m.role : null; },
  isManager(clubId: string, u: string | null | undefined) { const r = sel.roleIn(clubId, u); return r === 'board' || r === 'president'; },
  isPresident: (clubId: string, u: string | null | undefined) => sel.roleIn(clubId, u) === 'president',
  isAdvisor: (clubId: string, u: string | null | undefined) => sel.roleIn(clubId, u) === 'advisor',
  /** Süper admin yalnızca oturum sahibi için bilinir (custom claim). */
  isSuper: (u: string | null | undefined) => !!u && u === me() && session.s.isSuper,
  isMemberOf: (clubId: string, u: string | null | undefined) => !!sel.roleIn(clubId, u),
  canManage: (clubId: string, u: string | null | undefined) => sel.isManager(clubId, u) || sel.isSuper(u),
  mode(clubId: string, u: string | null | undefined): Access {
    if (sel.isSuper(u)) return 'super';
    const m = sel.membership(clubId, u); if (!m) return 'visitor';
    if (m.status === 'pending') return 'pending'; if (m.status === 'rejected') return 'rejected'; if (m.status === 'removed') return 'removed';
    if (m.status === 'active') { if (m.role === 'advisor') return 'advisor'; if (m.role === 'board' || m.role === 'president') return 'manager'; return 'member'; }
    return 'visitor';
  },
  canSeeInside(clubId: string, u: string | null | undefined) { return ['member', 'manager', 'advisor', 'super'].includes(sel.mode(clubId, u)); },
  myMemberships: (_u?: string | null): Membership[] => Object.values(session.s.memberships),
  myClubs(u?: string | null) { return sel.myMemberships(u).filter((m) => m.status === 'active').map((m) => ({ ...m, club: sel.club(m.clubId)! })).filter((m) => m.club && !m.club.isDeleted); },
  managedClubs(u?: string | null) {
    return sel.myMemberships(u).filter((m) => m.status === 'active' && ['board', 'president', 'advisor'].includes(m.role)).map((m) => ({ ...m, club: sel.club(m.clubId)!, readOnly: m.role === 'advisor' })).filter((m) => m.club);
  },
  pendingOf: (u?: string | null) => sel.myMemberships(u).filter((m) => m.status === 'pending'),
  /** Yüklenmiş üye listesi (db.memberships) */
  clubMembers(clubId: string) {
    return Object.values(db.memberships).filter((m) => m.clubId === clubId && m.status === 'active').map((m) => ({ ...m, user: sel.user(m.userId) }));
  },
  board(clubId: string) { return sel.clubMembers(clubId).filter((m) => m.role === 'board' || m.role === 'president').sort((a) => (a.role === 'president' ? -1 : 1)); },
  apps(clubId: string, status: string) { return Object.values(db.memberships).filter((m) => m.clubId === clubId && m.status === status && m.role === 'member').map((m) => ({ ...m, user: sel.user(m.userId) })); },
  pendingApps: (clubId: string) => sel.apps(clubId, 'pending').sort((a, b) => b.appliedAt - a.appliedAt),
  approvedApps: (clubId: string) => sel.apps(clubId, 'active').filter((m) => m.decidedAt).sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0)),
  rejectedApps: (clubId: string) => sel.apps(clubId, 'rejected').sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0)),
  visibleClubs: () => Object.values(db.clubs).filter((c) => c.status === 'active' && !c.isDeleted),
  allClubs: () => Object.values(db.clubs).filter((c) => !c.isDeleted),
  canSeeEvent(ev: ClubEvent | null, u: string | null | undefined) {
    if (!ev || ev.isDeleted) return false; if (ev.status === 'draft') return sel.canManage(ev.clubId, u);
    if (ev.visibility === 'public') return true; return sel.canSeeInside(ev.clubId, u);
  },
  eventRsvps: (eventId: string): Rsvp[] => Object.values(db.rsvps).filter((r) => r.eventId === eventId),
  registered: (eventId: string) => sel.eventRsvps(eventId).filter((r) => r.status === 'going' || r.status === 'attended'),
  waitlist: (eventId: string) => sel.eventRsvps(eventId).filter((r) => r.status === 'waitlist').sort((a, b) => (a.waitlistAt || a.createdAt) - (b.waitlistAt || b.createdAt)),
  attended: (eventId: string) => sel.eventRsvps(eventId).filter((r) => r.status === 'attended'),
  /** Kayıtlı sayısı = goingCount + attendedCount (sayaçlardan) */
  registeredCount: (ev: ClubEvent) => (ev.goingCount || 0) + (ev.attendedCount || 0),
  isFull: (ev: ClubEvent) => ev.capacity != null && sel.registeredCount(ev) >= ev.capacity,
  remaining: (ev: ClubEvent) => (ev.capacity == null ? Infinity : Math.max(0, ev.capacity - sel.registeredCount(ev))),
  myRsvp: (eventId: string, _u?: string | null): Rsvp | null => session.s.rsvps[eventId] || null,
  waitPosition: (eventId: string, _u?: string | null): number => db.extra['waitpos:' + eventId] || 0,
  userRsvps(_u?: string | null) { return Object.values(session.s.rsvps).map((r) => ({ ...r, event: sel.event(r.eventId)! })).filter((r) => r.event); },
  visibleEvents(u?: string | null) {
    return Object.values(db.events).filter((e) => e.status !== 'draft' && !e.isDeleted && (() => { const c = db.clubs[e.clubId]; return !c || c.status === 'active'; })() && sel.canSeeEvent(e, u));
  },
  clubEvents: (clubId: string) => Object.values(db.events).filter((e) => e.clubId === clubId && !e.isDeleted),
  notifsFor: (_u?: string | null): AppNotification[] => session.s.inbox,
  unread: (_u?: string | null) => session.s.inbox.filter((n) => !n.read).length,
  blockedBy: (_u?: string | null): string[] => session.s.blocked,
  clubPosts(clubId: string, _viewer?: string | null) {
    const blocked = session.s.blocked; const f = db.feeds['feed:' + clubId];
    const list = (f ? f.ids.map((id) => db.posts[id]) : Object.values(db.posts).filter((p) => p.clubId === clubId)).filter((p) => p && p.clubId === clubId && !p.isDeleted && !p.isHidden && !blocked.includes(p.authorId));
    return list.sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (b.createdAt - a.createdAt));
  },
  allPostsOf: (clubId: string) => Object.values(db.posts).filter((p) => p.clubId === clubId && !p.isDeleted).sort((a, b) => b.createdAt - a.createdAt),
  postComments(postId: string) { const blocked = session.s.blocked; return (db.comments[postId] || []).filter((c) => !c.isDeleted && !c.isHidden && !blocked.includes(c.authorId)); },
  savedIds: () => session.s.savedIds,
  isSaved: (_u: string | null | undefined, postId: string) => session.s.savedIds.includes(postId),
  dailyAnnouncements: (clubId: string): number => db.extra['ann:' + clubId + ':' + istanbulDay(Date.now()).key] || 0,
  canReapply: (m: Membership | null) => !m || !m.retryAfter || m.retryAfter <= Date.now(),
  settings: (_u?: string | null): Settings => session.s.settings || DEFAULT_SETTINGS,
  clubSettings: (_u: string | null | undefined, clubId: string): ClubPrefs => ({ ...DEFAULT_CLUB_PREFS, ...((session.s.settings.clubs || {})[clubId] || {}) }),
  attendanceRate(clubId: string, _u?: string | null) {
    const mine = Object.values(session.s.rsvps).filter((r) => r.clubId === clubId && r.status !== 'cancelled').map((r) => ({ r, e: db.events[r.eventId] })).filter((x) => x.e && x.e.endsAt < Date.now() && x.e.status === 'published');
    if (!mine.length) return null; return Math.round((mine.filter((x) => x.r.status === 'attended').length / mine.length) * 100);
  },
  /** Yönetici görünümü: üyenin son geçmiş etkinliklerdeki katılım oranı (mgtRatesLoader doldurur). */
  memberRate(clubId: string, u: string | null | undefined): number | null {
    const r = db.extra['rates:' + clubId];
    if (r && u && u in r) return r[u];
    return u && u === me() ? sel.attendanceRate(clubId, u) : null;
  },
  announcementLimit: () => LIMITS.announcementDailyLimit,
};
export type Sel = typeof sel;
