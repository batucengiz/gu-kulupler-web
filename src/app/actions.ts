/* Eylemler — prototipteki store.dispatch veri eylemlerinin Firestore karşılığı.
   Her eylem depoyu (repo) çağırır, başarıda veri aynasını/oturumu günceller; hata AppError olarak fırlar. */
import { db } from './data';
import { session } from './session';
import { sel } from './sel';
import { userCache } from '../data/repo/users';
import * as M from '../data/repo/memberships';
import * as P from '../data/repo/posts';
import * as CM from '../data/repo/comments';
import * as SV from '../data/repo/saved';
import * as E from '../data/repo/events';
import * as R from '../data/repo/rsvps';
import * as N from '../data/repo/notifications';
import * as RP from '../data/repo/reports';
import * as B from '../data/repo/blocks';
import * as ST from '../data/repo/settings';
import * as U from '../data/repo/users';
import * as A from '../data/repo/admin';
import * as SP from '../data/repo/support';
import * as DL from '../data/repo/deletion';
import { getClub, fetchActiveClubs } from '../data/repo/clubs';
import { AppError, touch } from '../data/fs';
import { updateDoc } from 'firebase/firestore';
import { ref, C, ids } from '../data/db';
import type { Club, ClubEvent, Membership, Post, Settings, ClubPrefs, User, AppNotification, PostImage } from '../data/models';
import { DEFAULT_CLUB_PREFS } from '../data/models';
import { istanbulDay } from '../lib/util';

const uid = () => { const u = session.s.uid; if (!u) throw new AppError('notSignedIn'); return u; };
const meUser = () => { const u = session.s.user; if (!u) throw new AppError('notSignedIn'); return u; };
const myEmail = () => session.s.email || '';
async function refreshClub(clubId: string) { try { db.putClubs([await getClub(clubId)]); } catch { /* sessiz */ } }
/** Yönetici listesi yenilemesi gereken anahtarlar */
const invalidateClub = (clubId: string) => { ['members', 'apps', 'mgt', 'feed', 'mgtPosts', 'activity', 'clubEvents'].forEach((k) => db.invalidate(`${k}:${clubId}`)); };

/* ================= üyelik ================= */
export async function joinClub(clubId: string, note = ''): Promise<'joined' | 'applied'> {
  const club = sel.club(clubId) || (await getClub(clubId));
  if (!club.applicationsOpen) throw new AppError('applicationsClosed');
  const prev = session.s.memberships[clubId];
  if (!club.approvalRequired && !(prev && (prev.status === 'rejected' || prev.status === 'removed'))) {
    await M.joinInstant({ clubId, applicant: meUser(), email: myEmail() });
    db.patchClub(clubId, { memberCount: (club.memberCount || 0) + 1 });
    void refreshClub(clubId); invalidateClub(clubId);
    return 'joined';
  }
  await M.apply({ clubId, applicant: meUser(), email: myEmail(), note });
  return 'applied';
}
export const cancelApplication = (clubId: string) => M.cancelApplication(clubId, uid());
export const saveApplicationNote = (clubId: string, note: string) => M.updateApplicationNote(clubId, uid(), note);
export async function leaveClub(clubId: string) { await M.leave(clubId, uid()); const c = db.clubs[clubId]; if (c) db.patchClub(clubId, { memberCount: Math.max(0, c.memberCount - 1) }); invalidateClub(clubId); }
function patchMember(clubId: string, userId: string, patch: Partial<Membership>) {
  const id = ids.membership(clubId, userId); const m = db.memberships[id];
  if (m) { db.memberships[id] = { ...m, ...patch }; db.changed(); }
}
export async function approve(clubId: string, userId: string) {
  await M.approve(clubId, userId, uid());
  patchMember(clubId, userId, { status: 'active', decidedAt: Date.now(), decidedBy: uid() });
  const c = db.clubs[clubId]; if (c) db.patchClub(clubId, { memberCount: c.memberCount + 1 });
  db.invalidate('mgt:' + clubId);
}
export async function reject(clubId: string, userId: string, reason: string, note = '') {
  await M.reject(clubId, userId, uid(), reason, note);
  patchMember(clubId, userId, { status: 'rejected', decidedAt: Date.now(), decidedBy: uid(), rejectReason: reason, rejectNote: note || null, retryAfter: Date.now() + 7 * 864e5 });
  db.invalidate('mgt:' + clubId);
}
export async function undoDecision(clubId: string, userId: string) {
  const prev = db.memberships[ids.membership(clubId, userId)];
  await M.undoDecision(clubId, userId, uid());
  patchMember(clubId, userId, { status: 'pending', decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null });
  if (prev?.status === 'active') { const c = db.clubs[clubId]; if (c) db.patchClub(clubId, { memberCount: Math.max(0, c.memberCount - 1) }); }
}
export async function removeMember(clubId: string, userId: string, note = '') {
  await M.remove({ clubId, userId, actorId: uid(), actorRole: sel.roleIn(clubId, uid()), actorIsSuper: session.s.isSuper, note });
  patchMember(clubId, userId, { status: 'removed', decidedAt: Date.now(), decidedBy: uid() });
  const c = db.clubs[clubId]; if (c) db.patchClub(clubId, { memberCount: Math.max(0, c.memberCount - 1) });
}
export async function undoRemoval(clubId: string, userId: string) {
  await M.undoRemoval(clubId, userId, uid());
  patchMember(clubId, userId, { status: 'active', role: 'member' });
  const c = db.clubs[clubId]; if (c) db.patchClub(clubId, { memberCount: c.memberCount + 1 });
}
export async function setRole(clubId: string, userId: string, role: 'member' | 'board') { await M.changeRole(clubId, userId, role, uid()); patchMember(clubId, userId, { role }); }
export async function transferPresidency(clubId: string, toUserId: string) {
  const club = sel.club(clubId) || (await getClub(clubId));
  if (session.s.isSuper && !sel.isPresident(clubId, uid())) {
    const toUser = sel.user(toUserId) || (await U.getUser(toUserId));
    if (!toUser) throw new AppError('notFound');
    await A.assignPresident({ clubId, toUser, actorId: uid() });
  } else await M.transferPresidency(clubId, club.presidentId, toUserId, uid());
  if (club.presidentId) patchMember(clubId, club.presidentId, { role: 'board' });
  patchMember(clubId, toUserId, { role: 'president', status: 'active' });
  db.patchClub(clubId, { presidentId: toUserId }); void refreshClub(clubId); invalidateClub(clubId);
}
export async function bulkDecide(clubId: string, userIds: string[], approveAll: boolean, reason = 'other', onProgress?: (d: number, t: number) => void) {
  return M.bulk(userIds, (u) => (approveAll ? approve(clubId, u) : reject(clubId, u, reason)), onProgress);
}

/* ================= gönderi / yorum ================= */
export async function toggleLike(post: Post): Promise<boolean> {
  const u = uid(); const liked = post.likes.includes(u);
  // iyimser güncelleme + geri alma
  db.patchPost(post.id, { likes: liked ? post.likes.filter((x) => x !== u) : [...post.likes, u], likeCount: Math.max(0, (post.likeCount || 0) + (liked ? -1 : 1)) });
  try { if (liked) await P.unlike(post.id, u); else await P.like(post.id, u); return !liked; }
  catch (e) { db.patchPost(post.id, { likes: post.likes, likeCount: post.likeCount }); throw e; }
}
export async function toggleSave(post: Post): Promise<boolean> {
  const u = uid(); const saved = session.s.savedIds.includes(post.id);
  if (saved) await SV.unsavePost(u, post.id); else await SV.savePost(u, post.id, post.clubId);
  session.patch({ savedIds: saved ? session.s.savedIds.filter((x) => x !== post.id) : [post.id, ...session.s.savedIds] });
  db.invalidate('saved');
  return !saved;
}
export async function vote(post: Post, optionId: string) {
  const u = uid(); await P.vote(post.id, u, optionId);
  const k = 'poll:' + post.id; const cur = db.extra[k] || { mine: null, counts: {} };
  db.setExtra(k, { mine: optionId, counts: { ...cur.counts, [optionId]: (cur.counts[optionId] || 0) + 1 } });
}
export async function loadPoll(post: Post) {
  const u = session.s.uid; if (!u || !post.poll) return;
  const mine = await P.myVote(post.id, u);
  const ended = post.poll.endsAt < Date.now();
  const show = !!mine || ended || !post.poll.showResultsAfterVote;
  const counts = show ? await P.countVotes(post.id, post.poll.options.map((o) => o.id)) : {};
  db.setExtra('poll:' + post.id, { mine, counts });
}
export async function createPost(p: { clubId: string; postId: string; type: Post['type']; title?: string | null; text: string; images: PostImage[]; poll?: P.PollDraft | null; push: boolean; pinned?: boolean }) {
  const club = sel.club(p.clubId);
  await P.publishPost({ type: p.type, title: p.title, text: p.text, images: p.images, poll: p.poll, pushSent: p.push }, { clubId: p.clubId, authorId: uid(), postId: p.postId, advisorUserId: club?.advisor?.userId });
  if (p.pinned) await P.pin(p.postId, p.clubId);
  try { const post = await P.getPost(p.postId); db.putPosts([post]); const f = db.feeds['feed:' + p.clubId]; if (f) f.ids = [post.id, ...f.ids]; } catch { /* sessiz */ }
  if (p.type === 'announcement' && p.push) { const k = 'ann:' + p.clubId + ':' + istanbulDay(Date.now()).key; db.setExtra(k, (db.extra[k] || 0) + 1); }
  if (p.pinned) db.patchClub(p.clubId, { pinnedPostId: p.postId });
  db.invalidate('feed:' + p.clubId); db.invalidate('mgtPosts:' + p.clubId);
  return p.postId;
}
export async function updatePost(postId: string, patch: P.PostEditPatch & { pinned?: boolean; clubId: string }) {
  await P.updatePost(postId, patch);
  const cur = db.posts[postId];
  if (patch.pinned !== undefined && cur && patch.pinned !== cur.pinned) { if (patch.pinned) await P.pin(postId, patch.clubId); else await P.unpin(postId, patch.clubId); }
  try { db.putPosts([await P.getPost(postId)]); } catch { /* sessiz */ }
}
export async function deletePost(post: Post) { await P.softDeletePost(post.id, uid(), post.clubId); db.patchPost(post.id, { isDeleted: true, pinned: false }); if (db.clubs[post.clubId]?.pinnedPostId === post.id) db.patchClub(post.clubId, { pinnedPostId: null }); }
export async function restorePost(post: Post) { await P.restorePost(post.id); db.patchPost(post.id, { isDeleted: false }); }
export async function setPinned(post: Post, pinned: boolean) {
  if (pinned) {
    await P.pin(post.id, post.clubId);
    Object.values(db.posts).forEach((x) => { if (x.clubId === post.clubId && x.pinned && x.id !== post.id) db.posts[x.id] = { ...x, pinned: false }; });
  } else await P.unpin(post.id, post.clubId);
  db.patchPost(post.id, { pinned }); db.patchClub(post.clubId, { pinnedPostId: pinned ? post.id : null });
}
export async function addComment(post: Post, text: string) {
  const id = await CM.addComment({ postId: post.id, clubId: post.clubId, authorId: uid(), text });
  const cur = db.posts[post.id]; if (cur) db.patchPost(post.id, { commentCount: (cur.commentCount || 0) + 1 });
  return id;
}
export async function deleteComment(postId: string, commentId: string) { await CM.softDeleteComment(commentId, postId, uid()); const cur = db.posts[postId]; if (cur) db.patchPost(postId, { commentCount: Math.max(0, cur.commentCount - 1) }); }
export async function restoreComment(postId: string, commentId: string) { await CM.restoreComment(commentId, postId); const cur = db.posts[postId]; if (cur) db.patchPost(postId, { commentCount: cur.commentCount + 1 }); }
export async function loadFeed(clubId: string, more = false) {
  const key = 'feed:' + clubId; const cur = db.feeds[key];
  const page = await P.listFeed(clubId, more && cur ? cur.cursor : null);
  db.putPosts(page.items);
  db.feeds[key] = { ids: [...(more && cur ? cur.ids : []), ...page.items.map((p) => p.id)], cursor: page.cursor, hasMore: page.hasMore };
  // sabit gönderi ilk sayfada değilse ayrıca getir
  const club = db.clubs[clubId];
  if (!more && club?.pinnedPostId && !db.feeds[key].ids.includes(club.pinnedPostId)) {
    try { const pp = await P.getPost(club.pinnedPostId); if (!pp.isDeleted && !pp.isHidden) { db.putPosts([pp]); db.feeds[key].ids.unshift(pp.id); } } catch { /* sessiz */ }
  }
  void U.loadUsers(page.items.map((p) => p.authorId));
  db.changed();
}

/* ================= etkinlik / kayıt ================= */
export async function joinEvent(eventId: string, reminder: R.Reminder) {
  const status = await R.joinEvent({ eventId, userId: uid(), reminder });
  const r = await R.getMyRsvp(eventId, uid()); session.setRsvp(eventId, r);
  try { db.putEvents([await E.getEvent(eventId, true)]); } catch { /* sessiz */ }
  let position = 0;
  if (status === 'waitlist' && r?.waitlistAt) { position = await R.waitlistPosition(eventId, r.clubId, r.waitlistAt).catch(() => 1); db.setExtra('waitpos:' + eventId, position); }
  return { status, position };
}
export async function leaveEvent(eventId: string) {
  await R.cancelRsvp(eventId, uid());
  const r = await R.getMyRsvp(eventId, uid()); session.setRsvp(eventId, r);
  try { db.putEvents([await E.getEvent(eventId, true)]); } catch { /* sessiz */ }
}
export async function setReminder(eventId: string, reminder: R.Reminder) {
  await R.setReminder(eventId, uid(), reminder);
  const r = session.s.rsvps[eventId]; if (r) session.setRsvp(eventId, { ...r, reminder });
}
export async function loadWaitPosition(eventId: string) {
  const r = session.s.rsvps[eventId]; if (!r || r.status !== 'waitlist' || !r.waitlistAt) return;
  db.setExtra('waitpos:' + eventId, await R.waitlistPosition(eventId, r.clubId, r.waitlistAt));
}
async function reloadEvent(eventId: string) { try { db.putEvents([await E.getEvent(eventId, true)]); } catch { /* sessiz */ } }
export async function saveEvent(d: E.EventDraft, p: { clubId: string; eventId?: string | null; publish?: boolean; notify?: boolean; cover?: File | Blob | null }) {
  const { prepareImage, upload, StoragePaths } = await import('../data/repo/storage');
  let id = p.eventId || null;
  if (!id) {
    id = await E.createEvent(d, { clubId: p.clubId, createdBy: uid(), status: 'draft' });
  } else await E.updateEvent(id, d);
  if (p.cover) { const path = await upload(StoragePaths.eventCover(id), await prepareImage(p.cover)); await E.setCoverPath(id, path); }
  if (p.publish) { await E.publish(id, uid()); }
  await reloadEvent(id);
  if (p.publish && p.notify !== false) { const club = sel.club(p.clubId) || (await getClub(p.clubId)); void E.notifyEventNew(id, club, db.events[id], uid()); }
  db.invalidate('clubEvents:' + p.clubId); db.invalidate('events');
  return id;
}
export async function publishEvent(ev: ClubEvent, notify = true) {
  await E.publish(ev.id, uid()); await reloadEvent(ev.id);
  if (notify) { const club = sel.club(ev.clubId) || (await getClub(ev.clubId)); void E.notifyEventNew(ev.id, club, ev, uid()); }
  db.invalidate('events');
}
export async function unpublishEvent(ev: ClubEvent) { await E.unpublish(ev.id); await reloadEvent(ev.id); db.invalidate('events'); }
export async function cancelEvent(ev: ClubEvent, reason: string) { await E.cancelEvent(ev.id, reason, uid()); await reloadEvent(ev.id); db.invalidate('events'); }
export async function duplicateEvent(ev: ClubEvent, suffix: string) { const id = await E.duplicate(ev, uid(), suffix); await reloadEvent(id); db.invalidate('clubEvents:' + ev.clubId); return id; }
export async function toggleRegistration(ev: ClubEvent) { await E.setRegistrationOpen(ev.id, !ev.registrationOpen); db.patchEvent(ev.id, { registrationOpen: !ev.registrationOpen }); return !ev.registrationOpen; }
export async function deleteEvent(ev: ClubEvent) { await E.softDeleteEvent(ev.id, uid()); db.patchEvent(ev.id, { isDeleted: true }); }
export async function restoreEvent(ev: ClubEvent) { await E.restoreEvent(ev.id); db.patchEvent(ev.id, { isDeleted: false }); }
export async function promote(ev: ClubEvent, userId: string) { await R.promote(ev.id, userId); await reloadEvent(ev.id); }
export async function setAttended(ev: ClubEvent, userId: string, attended: boolean) { await R.markAttended({ eventId: ev.id, userId, actorId: uid(), attended }); await reloadEvent(ev.id); }
export async function markAllAttended(ev: ClubEvent, onProgress?: (d: number, t: number) => void) { const r = await R.markAllAttended({ eventId: ev.id, clubId: ev.clubId, actorId: uid(), onProgress }); await reloadEvent(ev.id); return r; }
export async function scanTicket(ev: ClubEvent, input: string) { const r = await R.scanTicket({ event: ev, input, actorId: uid() }); if (r.outcome === 'valid') await reloadEvent(ev.id); return r; }

/* ================= bildirim ================= */
function patchInbox(id: string, patch: Partial<AppNotification> | null) {
  session.patch({ inbox: patch === null ? session.s.inbox.filter((n) => n.id !== id) : session.s.inbox.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
}
export async function markRead(n: AppNotification, read = true) { patchInbox(n.id, { read }); try { await N.markRead(n.id, read); } catch (e) { patchInbox(n.id, { read: n.read }); throw e; } }
export async function markAllRead() { const ids = session.s.inbox.filter((n) => !n.read).map((n) => n.id); session.patch({ inbox: session.s.inbox.map((n) => ({ ...n, read: true })) }); await N.markAllRead(ids); }
export async function deleteNotification(n: AppNotification) { patchInbox(n.id, null); await N.softDeleteNotification(n.id, uid()); }
export async function restoreNotification(n: AppNotification) { await N.restoreNotification(n.id); }

/* ================= şikayet ================= */
export const report = (target: RP.ReportTarget, reason: string, note = '') => RP.report(uid(), target, reason, note);
export async function resolveReports(group: RP.ReportGroup, action: 'removed' | 'dismissed' | 'suspended') {
  await RP.resolveReports(group, action, uid()); db.invalidate('reports');
  if (action === 'removed' && group.targetType === 'post') db.patchPost(group.targetId, { isHidden: true });
  if (action === 'suspended' && group.targetType === 'club') db.patchClub(group.targetId, { status: 'suspended' });
  if (action === 'suspended' && group.targetType === 'user') userCache.invalidate(group.targetId);
}

/* ================= kulüp ================= */
export type ClubSettingsPatch = Partial<Pick<Club, 'summary' | 'about' | 'conditions' | 'social' | 'approvalRequired' | 'applicationsOpen' | 'requireNote' | 'palette' | 'pattern' | 'coverSeed' | 'logoPath' | 'coverPath'>>;
export async function updateClubSettings(clubId: string, patch: ClubSettingsPatch) {
  const { writeBatch } = await import('firebase/firestore'); const { db: fdb } = await import('../lib/firebase'); const { addActivity } = await import('../data/repo/activity');
  const b = writeBatch(fdb); b.update(ref(C.clubs, clubId), { ...patch, ...touch() }); addActivity(b, { clubId, actorId: uid(), kind: 'settings_changed' }); await b.commit();
  db.patchClub(clubId, patch);
}
export async function setApplicationsOpen(clubId: string, open: boolean) { await updateClubSettings(clubId, { applicationsOpen: open }); }
export async function uploadClubImage(clubId: string, file: File, kind: 'logo' | 'cover') {
  const { prepareImage, upload, StoragePaths } = await import('../data/repo/storage');
  const path = await upload(StoragePaths.club(clubId), await prepareImage(file, kind === 'logo' ? 512 : 1600));
  await updateClubSettings(clubId, kind === 'logo' ? { logoPath: path } : { coverPath: path });
  return path;
}
export async function createClub(input: A.ClubCreateInput, president: User, presidentEmail: string, advisor?: { name: string; title: string } | null) {
  const id = await A.createClub(input, { president, presidentEmail, advisor: advisor || null }); await refreshClub(id); return id;
}
export async function updateClubIdentity(clubId: string, patch: A.ClubIdentityPatch) { await A.updateClubIdentity(clubId, patch); await refreshClub(clubId); }
export async function setClubStatus(clubId: string, suspended: boolean, reason = '') { if (suspended) await A.suspendClub(clubId, reason); else await A.activateClub(clubId); db.patchClub(clubId, { status: suspended ? 'suspended' : 'active', suspendReason: suspended ? reason : null }); }
export async function reloadClubs() { db.putClubs(await fetchActiveClubs()); }

/* ================= ayarlar / kullanıcı ================= */
export async function updateSettings(patch: Partial<Settings>) {
  const prev = session.s.settings; session.patch({ settings: { ...prev, ...patch } });
  try { await ST.updateSettings(uid(), patch); } catch (e) { session.patch({ settings: prev }); throw e; }
}
export async function updateClubPrefs(clubId: string, patch: Partial<ClubPrefs>) {
  const prev = session.s.settings; const cur = { ...DEFAULT_CLUB_PREFS, ...(prev.clubs[clubId] || {}) }; const next = { ...cur, ...patch };
  session.patch({ settings: { ...prev, clubs: { ...prev.clubs, [clubId]: next } } });
  try { await ST.updateClubSettings(uid(), clubId, next); } catch (e) { session.patch({ settings: prev }); throw e; }
}
export async function updateProfile(patch: U.UserProfilePatch) { await U.updateProfile(uid(), patch); await session.refreshUser(); }
export async function uploadAvatar(file: File) {
  const { prepareImage, upload, StoragePaths } = await import('../data/repo/storage');
  const path = await upload(StoragePaths.avatar(uid()), await prepareImage(file, 512));
  await updateProfile({ avatarPath: path }); return path;
}
export async function blockUser(targetId: string) { await B.block(uid(), targetId); session.patch({ blocked: [...new Set([...session.s.blocked, targetId])] }); }
export async function unblockUser(targetId: string) { await B.unblock(uid(), targetId); session.patch({ blocked: session.s.blocked.filter((x) => x !== targetId) }); }
export async function setUserStatus(userId: string, suspended: boolean, reason = '') { if (suspended) await A.suspendUser(userId, reason); else await A.activateUser(userId); userCache.invalidate(userId); await U.loadUsers([userId]); }
export async function deleteAccount(onProgress?: (s: string) => void) { await DL.deleteAccount(uid(), onProgress); }
export const precheckDeletion = () => DL.precheck(uid());
export const sendSupport = (subject: string, message: string, attachment?: File | null) => SP.createTicket({ userId: uid(), subject, message, attachment });
export async function touchUser(userId: string) { await updateDoc(ref(C.users, userId), touch()); }
export { updateDoc };
