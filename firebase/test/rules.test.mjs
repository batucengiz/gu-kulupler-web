// Firestore + Storage güvenlik kuralı testleri — çalışan emülatöre karşı (npm run test:rules).
// Her test kendi temiz verisiyle başlar; gerçek projeye hiçbir şey yazılmaz.
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, collection, query, where, serverTimestamp, increment,
  arrayUnion, arrayRemove, Timestamp, getCountFromServer,
} from 'firebase/firestore';
import { ref as sref, uploadBytes } from 'firebase/storage';

const PROJECT = 'demo-gu-rules-test';
const DOMAIN = '@ogr.gumushane.edu.tr';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(); });

/* ---------- bağlamlar ---------- */
const as = (uid, extra = {}) => env.authenticatedContext(uid, { email: `${uid}${DOMAIN}`, email_verified: true, ...extra }).firestore();
const unverified = (uid) => env.authenticatedContext(uid, { email: `${uid}${DOMAIN}`, email_verified: false }).firestore();
const foreign = (uid) => env.authenticatedContext(uid, { email: `${uid}@gmail.com`, email_verified: true }).firestore();
const superAdmin = () => as('admin', { superadmin: true });
const anon = () => env.unauthenticatedContext().firestore();

const now = () => Timestamp.now();
const ago = (ms) => Timestamp.fromMillis(Date.now() - ms);
const later = (ms) => Timestamp.fromMillis(Date.now() + ms);
const H = 36e5, D = 24 * H;
const base = () => ({ createdAt: ago(D), updatedAt: ago(D), isDeleted: false, deletedAt: null, deletedBy: null });
const ts = () => serverTimestamp();
const touch = () => ({ updatedAt: ts() });
const create = () => ({ createdAt: ts(), updatedAt: ts(), isDeleted: false, deletedAt: null, deletedBy: null });

const user = (id, o = {}) => ({ name: `Kişi ${id}`, nameLower: `kişi ${id}`, avatarSeed: id, avatarPath: null, department: 'd01', year: '2', interests: ['i01'], bio: '',
  status: 'active', suspendReason: null, staff: false, profileComplete: true, ...base(), ...o });
const club = (o = {}) => ({ name: 'Yazılım', nameLower: 'yazılım', categoryId: 'k01', iconName: 'code', palette: 'red', pattern: 'mountain', coverSeed: 'c', logoPath: null, coverPath: null,
  memberCount: 3, approvalRequired: true, applicationsOpen: true, requireNote: false, founded: 2015, summary: 's', about: 'a', conditions: [], social: { email: null, instagram: null, web: null },
  presidentId: 'pres', pinnedPostId: null, advisor: { name: 'Dr.', title: 'Dr.', userId: 'adv' }, status: 'active', suspendReason: null, lastMembershipRef: null, ...base(), ...o });
const mem = (c, u, role, status = 'active', o = {}) => ({ clubId: c, userId: u, status, role, note: '', applicant: { name: `Kişi ${u}`, department: 'd01', year: '2', avatarSeed: u },
  appliedAt: ago(10 * D), decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null, priorCount: 0, ...base(), ...o });
const ev = (o = {}) => ({ clubId: 'c1', createdBy: 'pres', title: 'Atölye', desc: '', type: 'egitim', startsAt: later(2 * D), endsAt: later(2 * D + 2 * H), placeId: 'pl01', placeText: null,
  capacity: 2, visibility: 'public', coverSeed: 'e', coverPalette: 'red', coverPattern: 'lines', registrationOpen: true, autoReminder: true, status: 'published', cancelReason: null, coverPath: null,
  goingCount: 1, waitlistCount: 0, attendedCount: 0, lastRsvpRef: null, publishedAt: ago(D), ...base(), ...o });
const post = (o = {}) => ({ clubId: 'c1', authorId: 'pres', type: 'post', title: null, text: 'Merhaba', images: [], poll: null, pinned: false, pushSent: false, likes: [], likeCount: 0,
  commentCount: 0, lastCommentRef: null, isHidden: false, hiddenBy: null, hiddenAt: null, editedAt: null, ...base(), ...o });

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore(); const b = writeBatch(db);
    for (const u of ['pres', 'board', 'memb', 'adv', 'out', 'pend', 'rej', 'admin', 'new']) b.set(doc(db, 'users', u), user(u));
    b.set(doc(db, 'users', 'susp'), user('susp', { status: 'suspended', suspendReason: 'x' }));
    b.set(doc(db, 'users', 'pres', 'private', 'account'), { email: `pres${DOMAIN}`, emailLower: `pres${DOMAIN}`, fcmTokens: [], lastLoginAt: null, ...base() });
    b.set(doc(db, 'clubs', 'c1'), club());
    b.set(doc(db, 'clubs', 'c2'), club({ name: 'Müzik', nameLower: 'müzik', approvalRequired: false, presidentId: 'p2', memberCount: 1 }));
    b.set(doc(db, 'memberships', 'c1_pres'), mem('c1', 'pres', 'president'));
    b.set(doc(db, 'memberships', 'c1_board'), mem('c1', 'board', 'board'));
    b.set(doc(db, 'memberships', 'c1_memb'), mem('c1', 'memb', 'member'));
    b.set(doc(db, 'memberships', 'c1_adv'), mem('c1', 'adv', 'advisor'));
    b.set(doc(db, 'memberships', 'c1_pend'), mem('c1', 'pend', 'member', 'pending'));
    b.set(doc(db, 'memberships', 'c1_rej'), mem('c1', 'rej', 'member', 'rejected', { retryAfter: later(3 * D), decidedAt: ago(4 * D), decidedBy: 'pres', rejectReason: 'quota' }));
    b.set(doc(db, 'memberships', 'c1_memb', 'private', 'contact'), { email: `memb${DOMAIN}`, emailLower: `memb${DOMAIN}`, ...base() });
    b.set(doc(db, 'memberships', 'c2_p2'), mem('c2', 'p2', 'president'));
    b.set(doc(db, 'events', 'e1'), ev());
    b.set(doc(db, 'events', 'e2'), ev({ visibility: 'members', capacity: null, goingCount: 0 }));
    b.set(doc(db, 'events', 'eNow'), ev({ startsAt: ago(H), endsAt: later(H), goingCount: 1 }));
    b.set(doc(db, 'events', 'eDraft'), ev({ status: 'draft', publishedAt: null, goingCount: 0 }));
    b.set(doc(db, 'rsvps', 'e1_memb'), { eventId: 'e1', clubId: 'c1', userId: 'memb', ticketCode: 'GU-ABCD-EFGH', status: 'going', reminder: '1h', waitlistAt: null, scannedAt: null, scannedBy: null, ...base() });
    b.set(doc(db, 'rsvps', 'eNow_memb'), { eventId: 'eNow', clubId: 'c1', userId: 'memb', ticketCode: 'GU-ABCD-EFGJ', status: 'going', reminder: '1h', waitlistAt: null, scannedAt: null, scannedBy: null, ...base() });
    b.set(doc(db, 'posts', 'p1'), post({ likes: ['board'], likeCount: 1 }));
    b.set(doc(db, 'posts', 'pHidden'), post({ isHidden: true, hiddenBy: 'admin', hiddenAt: ago(H) }));
    b.set(doc(db, 'posts', 'poll1'), post({ type: 'poll', poll: { options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }, { id: 'o3', text: 'C' }], endsAt: later(D), showResultsAfterVote: false } }));
    b.set(doc(db, 'posts', 'pollEnded'), post({ type: 'poll', poll: { options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }], endsAt: ago(H), showResultsAfterVote: false } }));
    b.set(doc(db, 'comments', 'cm1'), { postId: 'p1', clubId: 'c1', authorId: 'memb', text: 'Güzel', isHidden: false, hiddenBy: null, hiddenAt: null, ...base() });
    b.set(doc(db, 'reports', 'memb_post_p1'), { targetType: 'post', targetId: 'p1', targetClubId: 'c1', reporterId: 'memb', reason: 'spam', note: '', status: 'open', action: null, resolvedAt: null, resolvedBy: null, ...base() });
    b.set(doc(db, 'notifications', 'system_welcome_memb'), { userId: 'memb', type: 'system', refs: { textKey: 'welcome' }, read: false, ...base() });
    b.set(doc(db, 'activity', 'a1'), { clubId: 'c1', actorId: 'pres', kind: 'post_created', refs: { postId: 'p1' }, createdAt: ago(H) });
    await b.commit();
  });
}

const club1 = (db) => doc(db, 'clubs', 'c1');
const mref = (db, id) => doc(db, 'memberships', id);

/* ===================== users ===================== */
describe('users', () => {
  const profile = () => ({ name: 'Yeni Kişi', nameLower: 'yeni kişi', avatarSeed: 'new2', avatarPath: null, department: null, year: null, interests: [], bio: '',
    status: 'active', suspendReason: null, staff: false, profileComplete: false, ...create() });
  test('kendi profilini oluşturur', async () => { await assertSucceeds(setDoc(doc(as('new2'), 'users', 'new2'), profile())); });
  test('başkasının profilini oluşturamaz', async () => { await assertFails(setDoc(doc(as('new2'), 'users', 'other'), profile())); });
  test('doğrulanmamış e-posta oluşturamaz', async () => { await assertFails(setDoc(doc(unverified('new2'), 'users', 'new2'), profile())); });
  test('üniversite dışı alan adı okuyamaz', async () => { await assertFails(getDoc(doc(foreign('x'), 'users', 'memb'))); });
  test('oturumsuz okuyamaz', async () => { await assertFails(getDoc(doc(anon(), 'users', 'memb'))); });
  test('staff / profileComplete ile başlatamaz', async () => {
    await assertFails(setDoc(doc(as('new2'), 'users', 'new2'), { ...profile(), staff: true }));
  });
  test('profilini düzenler', async () => { await assertSucceeds(updateDoc(doc(as('memb'), 'users', 'memb'), { bio: 'Merhaba', ...touch() })); });
  test('kendi durumunu değiştiremez', async () => { await assertFails(updateDoc(doc(as('susp'), 'users', 'susp'), { status: 'active', suspendReason: null, ...touch() })); });
  test('askıdaki kullanıcı profil düzenleyemez', async () => { await assertFails(updateDoc(doc(as('susp'), 'users', 'susp'), { bio: 'x', ...touch() })); });
  test('updatedAt olmadan düzenleme reddedilir', async () => { await assertFails(updateDoc(doc(as('memb'), 'users', 'memb'), { bio: 'x' })); });
  test('140 karakteri aşan bio reddedilir', async () => { await assertFails(updateDoc(doc(as('memb'), 'users', 'memb'), { bio: 'x'.repeat(141), ...touch() })); });
  test('süper admin askıya alır', async () => { await assertSucceeds(updateDoc(doc(superAdmin(), 'users', 'memb'), { status: 'suspended', suspendReason: 'Spam', ...touch() })); });
  test('süper olmayan askıya alamaz', async () => { await assertFails(updateDoc(doc(as('pres'), 'users', 'memb'), { status: 'suspended', suspendReason: 'Spam', ...touch() })); });
  test('kimse silemez (süper dahil)', async () => { await assertFails(deleteDoc(doc(superAdmin(), 'users', 'memb'))); });
  test('hesap silme: anonimleştirme + soft delete', async () => {
    await assertSucceeds(updateDoc(doc(as('out'), 'users', 'out'), { name: 'Silinmiş kullanıcı', nameLower: 'silinmiş kullanıcı', bio: '', interests: [], avatarPath: null, department: null, year: null,
      status: 'deleted', isDeleted: true, deletedAt: ts(), deletedBy: 'out', ...touch() }));
  });
  test('private/account: yalnız sahibi ve süper okur', async () => {
    await assertSucceeds(getDoc(doc(as('pres'), 'users', 'pres', 'private', 'account')));
    await assertSucceeds(getDoc(doc(superAdmin(), 'users', 'pres', 'private', 'account')));
    await assertFails(getDoc(doc(as('board'), 'users', 'pres', 'private', 'account')));
  });
  test('private/account: başka e-posta yazılamaz', async () => {
    await assertFails(setDoc(doc(as('new2'), 'users', 'new2', 'private', 'account'), { email: 'baska@ogr.gumushane.edu.tr', emailLower: 'baska@ogr.gumushane.edu.tr', fcmTokens: [], lastLoginAt: null, ...create() }));
    await assertSucceeds(setDoc(doc(as('new2'), 'users', 'new2', 'private', 'account'), { email: `new2${DOMAIN}`, emailLower: `new2${DOMAIN}`, fcmTokens: [], lastLoginAt: null, ...create() }));
  });
  test('e-posta araması (collectionGroup private) yalnız süper', async () => {
    const { collectionGroup } = await import('firebase/firestore');
    await assertSucceeds(getDocs(query(collectionGroup(superAdmin(), 'private'), where('emailLower', '>=', 'p'), where('emailLower', '<', 'q'))));
    await assertFails(getDocs(query(collectionGroup(as('pres'), 'private'), where('emailLower', '>=', 'p'), where('emailLower', '<', 'q'))));
  });
});

/* ===================== clubs ===================== */
describe('clubs', () => {
  test('doğrulanmış kullanıcı aktif kulüpleri listeler', async () => { await assertSucceeds(getDocs(query(collection(as('out'), 'clubs'), where('isDeleted', '==', false)))); });
  test('filtresiz liste reddedilir (silinmiş sızmasın)', async () => { await assertFails(getDocs(collection(as('out'), 'clubs'))); });
  test('yönetici ayarları değiştirir', async () => { await assertSucceeds(updateDoc(club1(as('board')), { summary: 'Yeni özet', ...touch() })); });
  test('üye ayar değiştiremez', async () => { await assertFails(updateDoc(club1(as('memb')), { summary: 'x', ...touch() })); });
  test('danışman ayar değiştiremez', async () => { await assertFails(updateDoc(club1(as('adv')), { summary: 'x', ...touch() })); });
  test('yönetici kulüp adını değiştiremez', async () => { await assertFails(updateDoc(club1(as('pres')), { name: 'Başka', ...touch() })); });
  test('memberCount tek başına artırılamaz', async () => { await assertFails(updateDoc(club1(as('pres')), { memberCount: increment(1), lastMembershipRef: 'memberships/c1_memb', ...touch() })); });
  test('süper admin kulüp + başkan üyeliği oluşturur (tek batch)', async () => {
    const db = superAdmin(); const b = writeBatch(db);
    b.set(doc(db, 'clubs', 'c9'), { ...club({ name: 'Yeni', nameLower: 'yeni', memberCount: 1, presidentId: 'out', advisor: null, lastMembershipRef: 'memberships/c9_out' }), ...create() });
    b.set(mref(db, 'c9_out'), { ...mem('c9', 'out', 'president'), appliedAt: ts(), ...create() });
    await assertSucceeds(b.commit());
  });
  test('başkan üyeliği olmadan kulüp oluşturulamaz', async () => {
    await assertFails(setDoc(doc(superAdmin(), 'clubs', 'c9'), { ...club({ memberCount: 1, presidentId: 'out', lastMembershipRef: 'memberships/c9_out' }), ...create() }));
  });
  test('süper olmayan kulüp oluşturamaz', async () => {
    const db = as('pres'); const b = writeBatch(db);
    b.set(doc(db, 'clubs', 'c9'), { ...club({ memberCount: 1, presidentId: 'pres', lastMembershipRef: 'memberships/c9_pres' }), ...create() });
    b.set(mref(db, 'c9_pres'), { ...mem('c9', 'pres', 'president'), ...create() });
    await assertFails(b.commit());
  });
  test('süper admin askıya alır', async () => { await assertSucceeds(updateDoc(club1(superAdmin()), { status: 'suspended', suspendReason: 'Kural ihlali', ...touch() })); });
});

/* ===================== memberships ===================== */
describe('memberships', () => {
  const applyData = (u, c, status = 'pending') => ({ clubId: c, userId: u, status, role: 'member', note: 'Merhaba', applicant: { name: `Kişi ${u}`, department: 'd01', year: '2', avatarSeed: u },
    appliedAt: ts(), decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null, priorCount: 0, ...create() });
  test('M1 onaylı kulübe başvurur', async () => { await assertSucceeds(setDoc(mref(as('out'), 'c1_out'), applyData('out', 'c1'))); });
  test('M1 başkası adına başvuramaz', async () => { await assertFails(setDoc(mref(as('out'), 'c1_new'), applyData('new', 'c1'))); });
  test('M1 başvuru adı profilden farklıysa reddedilir', async () => {
    await assertFails(setDoc(mref(as('out'), 'c1_out'), { ...applyData('out', 'c1'), applicant: { name: 'Sahte', department: null, year: null, avatarSeed: 'out' } }));
  });
  test('M1 askıdaki kullanıcı başvuramaz', async () => { await assertFails(setDoc(mref(as('susp'), 'c1_susp'), applyData('susp', 'c1'))); });
  test('M1 onaylı kulüpte doğrudan active olunamaz', async () => {
    const db = as('out'); const b = writeBatch(db);
    b.set(mref(db, 'c1_out'), applyData('out', 'c1', 'active'));
    b.update(club1(db), { memberCount: increment(1), lastMembershipRef: 'memberships/c1_out', ...touch() });
    await assertFails(b.commit());
  });
  test('M1 başvurular kapalıyken reddedilir', async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'clubs', 'c1'), { applicationsOpen: false }));
    await assertFails(setDoc(mref(as('out'), 'c1_out'), applyData('out', 'c1')));
  });
  test('M2 anında katılım + memberCount +1 tek batch', async () => {
    const db = as('out'); const b = writeBatch(db);
    b.set(mref(db, 'c2_out'), applyData('out', 'c2', 'active'));
    b.update(doc(db, 'clubs', 'c2'), { memberCount: increment(1), lastMembershipRef: 'memberships/c2_out', ...touch() });
    await assertSucceeds(b.commit());
  });
  test('M2 sayaçsız anında katılım reddedilir', async () => { await assertFails(setDoc(mref(as('out'), 'c2_out'), applyData('out', 'c2', 'active'))); });
  test('M2 sayaç +2 reddedilir', async () => {
    const db = as('out'); const b = writeBatch(db);
    b.set(mref(db, 'c2_out'), applyData('out', 'c2', 'active'));
    b.update(doc(db, 'clubs', 'c2'), { memberCount: increment(2), lastMembershipRef: 'memberships/c2_out', ...touch() });
    await assertFails(b.commit());
  });
  test('M4 bekleme süresi dolmadan yeniden başvuru reddedilir', async () => {
    await assertFails(updateDoc(mref(as('rej'), 'c1_rej'), { status: 'pending', note: '', applicant: { name: 'Kişi rej', department: 'd01', year: '2', avatarSeed: 'rej' }, appliedAt: ts(), priorCount: 1,
      decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null, ...touch() }));
  });
  test('M4 bekleme süresi dolunca yeniden başvurur', async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'memberships', 'c1_rej'), { retryAfter: ago(H) }));
    await assertSucceeds(updateDoc(mref(as('rej'), 'c1_rej'), { status: 'pending', note: '', applicant: { name: 'Kişi rej', department: 'd01', year: '2', avatarSeed: 'rej' }, appliedAt: ts(), priorCount: 1,
      decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null, ...touch() }));
  });
  test('M7 başvurusunu geri çeker', async () => { await assertSucceeds(updateDoc(mref(as('pend'), 'c1_pend'), { status: 'cancelled', ...touch() })); });
  test('M5 yönetim kurulu onaylar (+1)', async () => {
    const db = as('board'); const b = writeBatch(db);
    b.update(mref(db, 'c1_pend'), { status: 'active', role: 'member', decidedAt: ts(), decidedBy: 'board', ...touch() });
    b.update(club1(db), { memberCount: increment(1), lastMembershipRef: 'memberships/c1_pend', ...touch() });
    await assertSucceeds(b.commit());
  });
  test('M5 üye onaylayamaz', async () => {
    const db = as('memb'); const b = writeBatch(db);
    b.update(mref(db, 'c1_pend'), { status: 'active', role: 'member', decidedAt: ts(), decidedBy: 'memb', ...touch() });
    b.update(club1(db), { memberCount: increment(1), lastMembershipRef: 'memberships/c1_pend', ...touch() });
    await assertFails(b.commit());
  });
  test('M5 danışman onaylayamaz (salt okunur)', async () => {
    const db = as('adv'); const b = writeBatch(db);
    b.update(mref(db, 'c1_pend'), { status: 'active', role: 'member', decidedAt: ts(), decidedBy: 'adv', ...touch() });
    b.update(club1(db), { memberCount: increment(1), lastMembershipRef: 'memberships/c1_pend', ...touch() });
    await assertFails(b.commit());
  });
  test('M5 onayla ama board rolü veremez', async () => {
    const db = as('board'); const b = writeBatch(db);
    b.update(mref(db, 'c1_pend'), { status: 'active', role: 'board', decidedAt: ts(), decidedBy: 'board', ...touch() });
    b.update(club1(db), { memberCount: increment(1), lastMembershipRef: 'memberships/c1_pend', ...touch() });
    await assertFails(b.commit());
  });
  test('M6 reddeder (7 gün ± tolerans)', async () => {
    await assertSucceeds(updateDoc(mref(as('board'), 'c1_pend'), { status: 'rejected', decidedAt: ts(), decidedBy: 'board', retryAfter: later(7 * D), rejectReason: 'quota', rejectNote: null, ...touch() }));
  });
  test('M6 bekleme süresi dışı retryAfter reddedilir', async () => {
    await assertFails(updateDoc(mref(as('board'), 'c1_pend'), { status: 'rejected', decidedAt: ts(), decidedBy: 'board', retryAfter: later(D), rejectReason: 'quota', rejectNote: null, ...touch() }));
  });
  test('M8 üye ayrılır (−1)', async () => {
    const db = as('memb'); const b = writeBatch(db);
    b.update(mref(db, 'c1_memb'), { status: 'left', ...touch() });
    b.update(club1(db), { memberCount: increment(-1), lastMembershipRef: 'memberships/c1_memb', ...touch() });
    await assertSucceeds(b.commit());
  });
  test('M8 başkan ayrılamaz', async () => {
    const db = as('pres'); const b = writeBatch(db);
    b.update(mref(db, 'c1_pres'), { status: 'left', ...touch() });
    b.update(club1(db), { memberCount: increment(-1), lastMembershipRef: 'memberships/c1_pres', ...touch() });
    await assertFails(b.commit());
  });
  const removal = (actor) => ({ status: 'removed', decidedAt: ts(), decidedBy: actor, retryAfter: later(7 * D), rejectReason: 'other', rejectNote: null, ...touch() });
  test('M9 başkan yönetim kurulu üyesini çıkarır', async () => {
    const db = as('pres'); const b = writeBatch(db);
    b.update(mref(db, 'c1_board'), removal('pres'));
    b.update(club1(db), { memberCount: increment(-1), lastMembershipRef: 'memberships/c1_board', ...touch() });
    await assertSucceeds(b.commit());
  });
  test('M9 yönetim kurulu başka kurul üyesini çıkaramaz', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'memberships', 'c1_b2'), mem('c1', 'b2', 'board')));
    const db = as('board'); const b = writeBatch(db);
    b.update(mref(db, 'c1_b2'), removal('board'));
    b.update(club1(db), { memberCount: increment(-1), lastMembershipRef: 'memberships/c1_b2', ...touch() });
    await assertFails(b.commit());
  });
  test('M9 danışman çıkarılamaz', async () => {
    const db = as('pres'); const b = writeBatch(db);
    b.update(mref(db, 'c1_adv'), removal('pres'));
    b.update(club1(db), { memberCount: increment(-1), lastMembershipRef: 'memberships/c1_adv', ...touch() });
    await assertFails(b.commit());
  });
  test('M9 başka kulübün yöneticisi çıkaramaz', async () => {
    const db = as('p2'); const b = writeBatch(db);
    b.update(mref(db, 'c1_memb'), removal('p2'));
    b.update(club1(db), { memberCount: increment(-1), lastMembershipRef: 'memberships/c1_memb', ...touch() });
    await assertFails(b.commit());
  });
  test('M10 başkan rol değiştirir, kurul değiştiremez', async () => {
    await assertFails(updateDoc(mref(as('board'), 'c1_memb'), { role: 'board', ...touch() }));
    await assertSucceeds(updateDoc(mref(as('pres'), 'c1_memb'), { role: 'board', ...touch() }));
  });
  test('M11 başkanlık devri tek batch', async () => {
    const db = as('pres'); const b = writeBatch(db);
    b.update(mref(db, 'c1_pres'), { role: 'board', ...touch() });
    b.update(mref(db, 'c1_board'), { role: 'president', ...touch() });
    b.update(club1(db), { presidentId: 'board', ...touch() });
    await assertSucceeds(b.commit());
  });
  test('M11 eksik batch (kulüp güncellenmeden) reddedilir', async () => {
    const db = as('pres'); const b = writeBatch(db);
    b.update(mref(db, 'c1_pres'), { role: 'board', ...touch() });
    b.update(mref(db, 'c1_board'), { role: 'president', ...touch() });
    await assertFails(b.commit());
  });
  test('M12 30 sn içinde onayı geri alır, süre geçince alamaz', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'memberships', 'c1_x'), mem('c1', 'x', 'member', 'active', { decidedAt: ago(5000), decidedBy: 'board' })));
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'memberships', 'c1_y'), mem('c1', 'y', 'member', 'active', { decidedAt: ago(31000), decidedBy: 'board' })));
    const undo = (id) => { const db = as('board'); const b = writeBatch(db);
      b.update(mref(db, id), { status: 'pending', decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null, ...touch() });
      b.update(club1(db), { memberCount: increment(-1), lastMembershipRef: 'memberships/' + id, ...touch() }); return b.commit(); };
    await assertSucceeds(undo('c1_x'));
    await assertFails(undo('c1_y'));
  });
  test('M14 hesap silmede anonimleştirme (−1)', async () => {
    const db = as('memb'); const b = writeBatch(db);
    b.update(doc(db, 'users', 'memb'), { name: 'Silinmiş kullanıcı', nameLower: 'silinmiş kullanıcı', bio: '', interests: [], avatarPath: null, department: null, year: null,
      status: 'deleted', isDeleted: true, deletedAt: ts(), deletedBy: 'memb', ...touch() });
    b.update(mref(db, 'c1_memb'), { status: 'left', applicant: { name: 'Silinmiş kullanıcı', department: null, year: null, avatarSeed: 'memb' }, ...touch() });
    b.update(club1(db), { memberCount: increment(-1), lastMembershipRef: 'memberships/c1_memb', ...touch() });
    b.update(doc(db, 'memberships', 'c1_memb', 'private', 'contact'), { email: '', emailLower: '', ...touch() });
    await assertSucceeds(b.commit());
  });
  test('M14 kullanıcı silinmeden anonimleştirme reddedilir', async () => {
    await assertFails(updateDoc(mref(as('pend'), 'c1_pend'), { status: 'cancelled', applicant: { name: 'Silinmiş kullanıcı', department: null, year: null, avatarSeed: 'pend' }, ...touch() }));
  });
  test('okuma: üye aktif üyeleri görür, bekleyenleri göremez', async () => {
    const db = as('memb');
    await assertSucceeds(getDocs(query(collection(db, 'memberships'), where('clubId', '==', 'c1'), where('status', '==', 'active'))));
    await assertFails(getDocs(query(collection(db, 'memberships'), where('clubId', '==', 'c1'), where('status', '==', 'pending'))));
    await assertSucceeds(getDocs(query(collection(as('adv'), 'memberships'), where('clubId', '==', 'c1'), where('status', '==', 'pending'))));
  });
  test('okuma: dışarıdan biri yalnız yönetici listesini görür', async () => {
    const db = as('out');
    await assertSucceeds(getDocs(query(collection(db, 'memberships'), where('clubId', '==', 'c1'), where('status', '==', 'active'), where('role', 'in', ['board', 'president']))));
    await assertFails(getDocs(query(collection(db, 'memberships'), where('clubId', '==', 'c1'), where('status', '==', 'active'))));
  });
  test('iletişim e-postası: yönetim okur, diğer üye okuyamaz', async () => {
    await assertSucceeds(getDoc(doc(as('board'), 'memberships', 'c1_memb', 'private', 'contact')));
    await assertSucceeds(getDoc(doc(as('memb'), 'memberships', 'c1_memb', 'private', 'contact')));
    await assertFails(getDoc(doc(as('pend'), 'memberships', 'c1_memb', 'private', 'contact')));
  });
  test('üyelik silinemez', async () => { await assertFails(deleteDoc(mref(superAdmin(), 'c1_memb'))); });
});

/* ===================== posts / comments / votes ===================== */
describe('posts', () => {
  const newPost = (o = {}) => ({ ...post({ authorId: 'board' }), ...create(), ...o });
  test('yönetici gönderi paylaşır', async () => { await assertSucceeds(setDoc(doc(as('board'), 'posts', 'n1'), newPost())); });
  test('üye gönderi paylaşamaz', async () => { await assertFails(setDoc(doc(as('memb'), 'posts', 'n1'), newPost({ authorId: 'memb' }))); });
  test('beğeni sayısı ile başlatılamaz', async () => { await assertFails(setDoc(doc(as('board'), 'posts', 'n1'), newPost({ likeCount: 5 }))); });
  test('başka gönderinin görsel yolu reddedilir', async () => {
    await assertFails(setDoc(doc(as('board'), 'posts', 'n1'), newPost({ images: [{ path: 'posts/other/x.jpg', w: 1, h: 1 }] })));
    await assertSucceeds(setDoc(doc(as('board'), 'posts', 'n1'), newPost({ images: [{ path: 'posts/n1/x.jpg', w: 1, h: 1 }] })));
  });
  test('üye beğenir ve geri alır', async () => {
    await assertSucceeds(updateDoc(doc(as('memb'), 'posts', 'p1'), { likes: arrayUnion('memb'), likeCount: increment(1) }));
    await assertSucceeds(updateDoc(doc(as('memb'), 'posts', 'p1'), { likes: arrayRemove('memb'), likeCount: increment(-1) }));
  });
  test('başkası adına beğeni reddedilir', async () => { await assertFails(updateDoc(doc(as('memb'), 'posts', 'p1'), { likes: arrayUnion('pend'), likeCount: increment(1) })); });
  test('başkasının beğenisini kaldıramaz', async () => { await assertFails(updateDoc(doc(as('memb'), 'posts', 'p1'), { likes: arrayRemove('board'), likeCount: increment(-1) })); });
  test('beğeniye updatedAt eklenirse reddedilir', async () => { await assertFails(updateDoc(doc(as('memb'), 'posts', 'p1'), { likes: arrayUnion('memb'), likeCount: increment(1), ...touch() })); });
  test('danışman beğenemez, üye olmayan beğenemez', async () => {
    await assertFails(updateDoc(doc(as('adv'), 'posts', 'p1'), { likes: arrayUnion('adv'), likeCount: increment(1) }));
    await assertFails(updateDoc(doc(as('out'), 'posts', 'p1'), { likes: arrayUnion('out'), likeCount: increment(1) }));
  });
  test('akış: üye görür, üye olmayan göremez', async () => {
    const q = (db) => query(collection(db, 'posts'), where('clubId', '==', 'c1'), where('isDeleted', '==', false), where('isHidden', '==', false));
    await assertSucceeds(getDocs(q(as('memb'))));
    await assertFails(getDocs(q(as('out'))));
  });
  test('gizlenmiş gönderiyi üye okuyamaz, yönetici okur', async () => {
    await assertFails(getDoc(doc(as('memb'), 'posts', 'pHidden')));
    await assertSucceeds(getDoc(doc(as('board'), 'posts', 'pHidden')));
  });
  test('yönetici soft delete yapar, silemez', async () => {
    await assertSucceeds(updateDoc(doc(as('board'), 'posts', 'p1'), { isDeleted: true, deletedAt: ts(), deletedBy: 'board', pinned: false, ...touch() }));
    await assertFails(deleteDoc(doc(as('board'), 'posts', 'p1')));
  });
  test('süper admin gizler', async () => { await assertSucceeds(updateDoc(doc(superAdmin(), 'posts', 'p1'), { isHidden: true, hiddenBy: 'admin', hiddenAt: ts(), ...touch() })); });
  test('yorum + commentCount +1 tek batch', async () => {
    const db = as('memb'); const b = writeBatch(db); const r = doc(collection(db, 'comments'));
    b.set(r, { postId: 'p1', clubId: 'c1', authorId: 'memb', text: 'Harika', isHidden: false, hiddenBy: null, hiddenAt: null, ...create() });
    b.update(doc(db, 'posts', 'p1'), { commentCount: increment(1), lastCommentRef: `comments/${r.id}` });
    await assertSucceeds(b.commit());
  });
  test('sayaçsız yorum reddedilir', async () => {
    await assertFails(setDoc(doc(collection(as('memb'), 'comments')), { postId: 'p1', clubId: 'c1', authorId: 'memb', text: 'x', isHidden: false, hiddenBy: null, hiddenAt: null, ...create() }));
  });
  test('yorum sayacı tek başına artırılamaz', async () => {
    await assertFails(updateDoc(doc(as('memb'), 'posts', 'p1'), { commentCount: increment(1), lastCommentRef: 'comments/cm1' }));
  });
  test('üye olmayan yorum yapamaz', async () => {
    const db = as('out'); const b = writeBatch(db); const r = doc(collection(db, 'comments'));
    b.set(r, { postId: 'p1', clubId: 'c1', authorId: 'out', text: 'x', isHidden: false, hiddenBy: null, hiddenAt: null, ...create() });
    b.update(doc(db, 'posts', 'p1'), { commentCount: increment(1), lastCommentRef: `comments/${r.id}` });
    await assertFails(b.commit());
  });
  test('yönetici yorumu siler (−1)', async () => {
    const db = as('board'); const b = writeBatch(db);
    b.update(doc(db, 'comments', 'cm1'), { isDeleted: true, deletedAt: ts(), deletedBy: 'board', ...touch() });
    b.update(doc(db, 'posts', 'p1'), { commentCount: increment(-1), lastCommentRef: 'comments/cm1' });
    await assertSucceeds(b.commit());
  });
  test('başkasının yorumunu üye silemez', async () => {
    const db = as('pres'); await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'memberships', 'c1_m2'), mem('c1', 'm2', 'member')));
    const db2 = as('m2'); const b = writeBatch(db2);
    b.update(doc(db2, 'comments', 'cm1'), { isDeleted: true, deletedAt: ts(), deletedBy: 'm2', ...touch() });
    b.update(doc(db2, 'posts', 'p1'), { commentCount: increment(-1), lastCommentRef: 'comments/cm1' });
    await assertFails(b.commit()); void db;
  });
  test('anket: geçerli oy, geçersiz seçenek, süresi dolmuş anket, ikinci oy', async () => {
    const v = (db, p, o) => setDoc(doc(db, 'posts', p, 'votes', 'memb'), { optionId: o, createdAt: ts() });
    await assertFails(v(as('memb'), 'poll1', 'o4'));
    await assertFails(v(as('memb'), 'pollEnded', 'o1'));
    await assertSucceeds(v(as('memb'), 'poll1', 'o3'));
    await assertFails(v(as('memb'), 'poll1', 'o1'));
  });
  test('anket: başkası adına oy verilemez', async () => {
    await assertFails(setDoc(doc(as('memb'), 'posts', 'poll1', 'votes', 'board'), { optionId: 'o1', createdAt: ts() }));
  });
  test('duyuru (bildirimli) + günlük sayaç; 3. duyuru reddedilir', async () => {
    const key = (() => { const d = new Date(Date.now() + 3 * H); const p = (n) => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`; })();
    const ann = (id, count) => { const db = as('board'); const b = writeBatch(db);
      b.set(doc(db, 'posts', id), newPost({ type: 'announcement', title: 'Duyuru', pushSent: true }));
      b.set(doc(db, 'announcementCounters', `c1_${key}`), { clubId: 'c1', day: key, count, lastPostRef: `posts/${id}`, updatedAt: ts() }, { merge: true });
      return b.commit(); };
    await assertSucceeds(ann('a1', 1));
    await assertSucceeds(ann('a2', 2));
    await assertFails(ann('a3', 3));
    // sayaçsız bildirimli duyuru
    await assertFails(setDoc(doc(as('board'), 'posts', 'a4'), newPost({ type: 'announcement', title: 'x', pushSent: true })));
  });
});

/* ===================== events / rsvps ===================== */
describe('events', () => {
  const draft = (o = {}) => ({ ...ev({ status: 'draft', publishedAt: null, goingCount: 0, createdBy: 'board' }), ...create(), ...o });
  test('yönetici taslak oluşturur, üye oluşturamaz', async () => {
    await assertSucceeds(setDoc(doc(as('board'), 'events', 'n1'), draft()));
    await assertFails(setDoc(doc(as('memb'), 'events', 'n2'), draft({ createdBy: 'memb' })));
  });
  test('bitişi başlangıçtan önce olan etkinlik reddedilir', async () => {
    await assertFails(setDoc(doc(as('board'), 'events', 'n1'), draft({ endsAt: later(D) })));
  });
  test('geçmiş tarihli yayın reddedilir', async () => {
    await assertFails(setDoc(doc(as('board'), 'events', 'n1'), draft({ status: 'published', publishedAt: ts(), startsAt: ago(H), endsAt: later(H) })));
  });
  test('herkese açık etkinliği herkes, üyelere özeli yalnız üyeler okur', async () => {
    await assertSucceeds(getDoc(doc(as('out'), 'events', 'e1')));
    await assertFails(getDoc(doc(as('out'), 'events', 'e2')));
    await assertSucceeds(getDoc(doc(as('memb'), 'events', 'e2')));
    await assertFails(getDoc(doc(as('memb'), 'events', 'eDraft')));
    await assertSucceeds(getDoc(doc(as('board'), 'events', 'eDraft')));
  });
  const join = (u, e, status, field) => { const db = as(u); const b = writeBatch(db);
    b.set(doc(db, 'rsvps', `${e}_${u}`), { eventId: e, clubId: 'c1', userId: u, ticketCode: 'GU-WXYZ-2345', status, reminder: '1h', waitlistAt: status === 'waitlist' ? ts() : null, scannedAt: null, scannedBy: null, ...create() });
    b.update(doc(db, 'events', e), { [field]: increment(1), lastRsvpRef: `rsvps/${e}_${u}`, ...touch() });
    return b.commit(); };
  test('katıl (going +1), kontenjan dolunca going reddedilir, waitlist kabul', async () => {
    await assertSucceeds(join('out', 'e1', 'going', 'goingCount'));
    await assertFails(join('pend', 'e1', 'going', 'goingCount'));
    await assertSucceeds(join('pend', 'e1', 'waitlist', 'waitlistCount'));
  });
  test('yer varken bekleme listesine girilemez', async () => { await assertFails(join('out', 'e1', 'waitlist', 'waitlistCount')); });
  test('üyelere özel etkinliğe dışarıdan katılınamaz', async () => { await assertFails(join('out', 'e2', 'going', 'goingCount')); });
  test('taslak etkinliğe katılınamaz', async () => { await assertFails(join('board', 'eDraft', 'going', 'goingCount')); });
  test('geçersiz bilet kodu reddedilir', async () => {
    const db = as('out'); const b = writeBatch(db);
    b.set(doc(db, 'rsvps', 'e1_out'), { eventId: 'e1', clubId: 'c1', userId: 'out', ticketCode: 'GU-IIII-OOOO', status: 'going', reminder: '1h', waitlistAt: null, scannedAt: null, scannedBy: null, ...create() });
    b.update(doc(db, 'events', 'e1'), { goingCount: increment(1), lastRsvpRef: 'rsvps/e1_out', ...touch() });
    await assertFails(b.commit());
  });
  test('kaydını iptal eder (−1)', async () => {
    const db = as('memb'); const b = writeBatch(db);
    b.update(doc(db, 'rsvps', 'e1_memb'), { status: 'cancelled', waitlistAt: null, ...touch() });
    b.update(doc(db, 'events', 'e1'), { goingCount: increment(-1), lastRsvpRef: 'rsvps/e1_memb', ...touch() });
    await assertSucceeds(b.commit());
  });
  test('yoklama: pencere içinde yönetici alır, üye alamaz, pencere dışında reddedilir', async () => {
    const mark = (u, e) => { const db = as(u); const b = writeBatch(db);
      b.update(doc(db, 'rsvps', `${e}_memb`), { status: 'attended', scannedAt: ts(), scannedBy: u, ...touch() });
      b.update(doc(db, 'events', e), { attendedCount: increment(1), lastRsvpRef: `rsvps/${e}_memb`, ...touch() });
      return b.commit(); };
    await assertFails(mark('memb', 'eNow'));
    await assertFails(mark('board', 'e1'));
    await assertSucceeds(mark('board', 'eNow'));
  });
  test('kendi kaydını attended yapamaz', async () => {
    await assertFails(updateDoc(doc(as('memb'), 'rsvps', 'eNow_memb'), { status: 'attended', scannedAt: ts(), scannedBy: 'memb', ...touch() }));
  });
  test('bekleme listesinden alma (+1/−1)', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      await setDoc(doc(db, 'rsvps', 'e1_w'), { eventId: 'e1', clubId: 'c1', userId: 'w', ticketCode: 'GU-WWWW-2222', status: 'waitlist', reminder: '1h', waitlistAt: ago(H), scannedAt: null, scannedBy: null, ...base() });
      await updateDoc(doc(db, 'events', 'e1'), { waitlistCount: 1 });
    });
    const db = as('board'); const b = writeBatch(db);
    b.update(doc(db, 'rsvps', 'e1_w'), { status: 'going', waitlistAt: null, ...touch() });
    b.update(doc(db, 'events', 'e1'), { goingCount: increment(1), waitlistCount: increment(-1), lastRsvpRef: 'rsvps/e1_w', ...touch() });
    await assertSucceeds(b.commit());
  });
  test('kayıt sayacı tek başına değiştirilemez', async () => {
    await assertFails(updateDoc(doc(as('board'), 'events', 'e1'), { goingCount: increment(-1), lastRsvpRef: 'rsvps/e1_memb', ...touch() }));
  });
  test('katılımcı listesi: yönetim görür, üye göremez', async () => {
    const q = (db) => query(collection(db, 'rsvps'), where('eventId', '==', 'e1'), where('clubId', '==', 'c1'));
    await assertSucceeds(getDocs(q(as('board'))));
    await assertFails(getDocs(q(as('memb'))));
  });
  test('bekleme sırası sayımı herkes için açık', async () => {
    await assertSucceeds(getCountFromServer(query(collection(as('out'), 'rsvps'), where('eventId', '==', 'e1'), where('clubId', '==', 'c1'), where('status', '==', 'waitlist'), where('waitlistAt', '<', now()))));
  });
  test('kayıtlı etkinlik yayından kaldırılamaz, iptal edilebilir', async () => {
    await assertFails(updateDoc(doc(as('board'), 'events', 'e1'), { status: 'draft', publishedAt: null, ...touch() }));
    await assertSucceeds(updateDoc(doc(as('board'), 'events', 'e1'), { status: 'cancelled', cancelReason: 'Hava durumu', registrationOpen: false, ...touch() }));
  });
  test('yalnız taslak silinir', async () => {
    await assertFails(updateDoc(doc(as('board'), 'events', 'e1'), { isDeleted: true, deletedAt: ts(), deletedBy: 'board', ...touch() }));
    await assertSucceeds(updateDoc(doc(as('board'), 'events', 'eDraft'), { isDeleted: true, deletedAt: ts(), deletedBy: 'board', ...touch() }));
  });
});

/* ===================== notifications / reports / activity / diğer ===================== */
describe('notifications', () => {
  const n = (type, refs, userId) => ({ userId, type, refs, read: false, ...create() });
  test('başvuran yöneticiye application_received yazar', async () => {
    await assertSucceeds(setDoc(doc(as('pend'), 'notifications', 'application_received_c1-pend-x_pres'), n('application_received', { clubId: 'c1', applicantId: 'pend' }, 'pres')));
  });
  test('başvurusu olmayan application_received yazamaz', async () => {
    await assertFails(setDoc(doc(as('out'), 'notifications', 'application_received_c1-out-x_pres'), n('application_received', { clubId: 'c1', applicantId: 'out' }, 'pres')));
  });
  test('yönetici olmayan onay bildirimi yazamaz', async () => {
    await assertFails(setDoc(doc(as('memb'), 'notifications', 'application_approved_c1-x_out'), n('application_approved', { clubId: 'c1' }, 'out')));
    await assertSucceeds(setDoc(doc(as('board'), 'notifications', 'application_approved_c1-x_out'), n('application_approved', { clubId: 'c1' }, 'out')));
  });
  test('sistem bildirimi yalnız süper', async () => {
    await assertFails(setDoc(doc(as('pres'), 'notifications', 'system_x_out'), n('system', { textKey: 'x' }, 'out')));
  });
  test('başkasının bildirimini okuyamaz / işaretleyemez', async () => {
    await assertFails(getDoc(doc(as('out'), 'notifications', 'system_welcome_memb')));
    await assertFails(updateDoc(doc(as('out'), 'notifications', 'system_welcome_memb'), { read: true, ...touch() }));
    await assertSucceeds(updateDoc(doc(as('memb'), 'notifications', 'system_welcome_memb'), { read: true, ...touch() }));
  });
  test('kendi bildirimini kendine yazma (hatırlatıcı) serbest, başkasına değil', async () => {
    await assertSucceeds(setDoc(doc(as('memb'), 'notifications', 'event_reminder_e1_memb'), n('event_reminder', { eventId: 'e1', clubId: 'c1' }, 'memb')));
    await assertFails(setDoc(doc(as('memb'), 'notifications', 'event_reminder_e1_out'), n('event_reminder', { eventId: 'e1', clubId: 'c1' }, 'out')));
  });
});
describe('reports', () => {
  const r = (o = {}) => ({ targetType: 'post', targetId: 'p1', targetClubId: 'c1', reporterId: 'out', reason: 'spam', note: '', status: 'open', action: null, resolvedAt: null, resolvedBy: null, ...create(), ...o });
  test('bildirir, tekrar bildiremez', async () => {
    await assertSucceeds(setDoc(doc(as('out'), 'reports', 'out_post_p1'), r()));
    await assertFails(setDoc(doc(as('out'), 'reports', 'out_post_p1'), r()));
  });
  test('geçersiz gerekçe / kendini bildirme reddedilir', async () => {
    await assertFails(setDoc(doc(as('out'), 'reports', 'out_post_p1'), r({ reason: 'nefret' })));
    await assertFails(setDoc(doc(as('out'), 'reports', 'out_user_out'), r({ targetType: 'user', targetId: 'out', targetClubId: null })));
  });
  test('kendi bildirim kimliğini sorgular, başkasınınkini sorgulayamaz', async () => {
    await assertSucceeds(getDoc(doc(as('out'), 'reports', 'out_post_p9')));
    await assertFails(getDoc(doc(as('out'), 'reports', 'memb_post_p1')));
  });
  test('yalnız süper çözer ve listeler', async () => {
    await assertFails(getDocs(query(collection(as('pres'), 'reports'), where('status', '==', 'open'))));
    await assertSucceeds(getDocs(query(collection(superAdmin(), 'reports'), where('status', '==', 'open'))));
    await assertSucceeds(updateDoc(doc(superAdmin(), 'reports', 'memb_post_p1'), { status: 'resolved', action: 'dismissed', resolvedAt: ts(), resolvedBy: 'admin', ...touch() }));
  });
});
describe('activity', () => {
  test('yönetim görür, üye göremez', async () => {
    await assertSucceeds(getDocs(query(collection(as('adv'), 'activity'), where('clubId', '==', 'c1'))));
    await assertFails(getDocs(query(collection(as('memb'), 'activity'), where('clubId', '==', 'c1'))));
  });
  test('üye yönetici faaliyeti uyduramaz', async () => {
    await assertFails(setDoc(doc(collection(as('memb'), 'activity')), { clubId: 'c1', actorId: 'memb', kind: 'application_approved', refs: {}, createdAt: ts() }));
    await assertFails(setDoc(doc(collection(as('board'), 'activity')), { clubId: 'c1', actorId: 'pres', kind: 'post_created', refs: {}, createdAt: ts() }));
    await assertSucceeds(setDoc(doc(collection(as('board'), 'activity')), { clubId: 'c1', actorId: 'board', kind: 'post_created', refs: {}, createdAt: ts() }));
  });
});
describe('settings / blocks / savedPosts / support', () => {
  test('ayarlar yalnız sahibine', async () => {
    await assertSucceeds(setDoc(doc(as('memb'), 'settings', 'memb'), { announcements: true, reminderTime: '1h', clubs: {}, updatedAt: ts() }));
    await assertFails(getDoc(doc(as('out'), 'settings', 'memb')));
    await assertFails(setDoc(doc(as('memb'), 'settings', 'memb'), { admin: true, updatedAt: ts() }));
  });
  test('engelleme: oluştur, kaldır, başkası adına engelleyemez', async () => {
    await assertSucceeds(getDoc(doc(as('memb'), 'blocks', 'memb_out')));
    await assertSucceeds(setDoc(doc(as('memb'), 'blocks', 'memb_out'), { blockerId: 'memb', blockedId: 'out', ...create() }));
    await assertSucceeds(updateDoc(doc(as('memb'), 'blocks', 'memb_out'), { isDeleted: true, deletedAt: ts(), deletedBy: 'memb', ...touch() }));
    await assertFails(setDoc(doc(as('memb'), 'blocks', 'out_pres'), { blockerId: 'out', blockedId: 'pres', ...create() }));
    await assertFails(getDoc(doc(as('pres'), 'blocks', 'memb_out')));
  });
  test('kaydet: kendi kaydı', async () => {
    await assertSucceeds(setDoc(doc(as('memb'), 'savedPosts', 'memb_p1'), { userId: 'memb', postId: 'p1', clubId: 'c1', savedAt: ts(), ...create() }));
    await assertFails(setDoc(doc(as('memb'), 'savedPosts', 'out_p1'), { userId: 'out', postId: 'p1', clubId: 'c1', savedAt: ts(), ...create() }));
  });
  test('destek talebi', async () => {
    const t = (o = {}) => ({ ticketNo: 'GU-ABC234', userId: 'memb', subject: 'bug', message: 'Hata var', attachmentPaths: [], status: 'open', ...create(), ...o });
    await assertSucceeds(setDoc(doc(collection(as('memb'), 'supportTickets')), t()));
    await assertFails(setDoc(doc(collection(as('memb'), 'supportTickets')), t({ subject: 'para' })));
    await assertFails(setDoc(doc(collection(as('memb'), 'supportTickets')), t({ attachmentPaths: ['users/x/y.jpg'] })));
  });
  test('tanımsız koleksiyon kapalı', async () => {
    await assertFails(setDoc(doc(as('memb'), 'secrets', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(superAdmin(), 'secrets', 'x')));
  });
});

/* ===================== storage ===================== */
// Storage → Firestore çapraz okuması emülatörde yalnızca ana demo projesinde çalışır (singleProjectMode);
// bu yüzden bu bölüm seed verisini (demo-gu-kulupler: c01 yönetim kurulu u_elif, üye u_burak, c02 başkanı u_p_c02) kullanır
// ve Firestore'a yazmaz. Yüklenen deneme dosyaları rastgele adlıdır, uygulamada hiçbir belgeye bağlı değildir.
describe('storage', () => {
  let senv;
  before(async () => {
    senv = await initializeTestEnvironment({ projectId: 'demo-gu-kulupler',
      storage: { host: '127.0.0.1', port: 9199, rules: readFileSync(new URL('../storage.rules', import.meta.url), 'utf8') } });
  });
  after(async () => { await senv?.cleanup(); });
  const st = (uid, extra = {}) => senv.authenticatedContext(uid, { email: `${uid}${DOMAIN}`, email_verified: true, ...extra }).storage();
  const rnd = () => Math.random().toString(36).slice(2);
  const img = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const up = (s, path, md = {}) => uploadBytes(sref(s, path), img(), { contentType: 'image/jpeg', ...md });
  test('kendi profil fotoğrafını yükler, başkasınınkini yükleyemez', async () => {
    await assertSucceeds(up(st('u_burak'), `users/u_burak/t-${rnd()}.jpg`));
    await assertFails(up(st('u_burak'), `users/u_ayse/t-${rnd()}.jpg`));
  });
  test('doğrulanmamış hesap yükleyemez', async () => {
    const s = senv.authenticatedContext('u_burak', { email: 'u_burak' + DOMAIN, email_verified: false }).storage();
    await assertFails(up(s, `users/u_burak/t-${rnd()}.jpg`));
  });
  test('görsel olmayan dosya reddedilir', async () => {
    await assertFails(uploadBytes(sref(st('u_burak'), `users/u_burak/t-${rnd()}.txt`), img(), { contentType: 'text/plain' }));
  });
  test('5 MB ve üstü reddedilir', async () => {
    await assertFails(uploadBytes(sref(st('u_burak'), `users/u_burak/t-${rnd()}.jpg`), new Uint8Array(5 * 1024 * 1024), { contentType: 'image/jpeg' }));
  });
  test('üzerine yazma reddedilir', async () => {
    const p = `users/u_burak/t-${rnd()}.jpg`;
    await assertSucceeds(up(st('u_burak'), p));
    await assertFails(up(st('u_burak'), p));
  });
  test('gönderi görseli: yönetici yükler, üye ve metadata\'sız yükleme reddedilir', async () => {
    const id = 'test-' + rnd();
    await assertSucceeds(up(st('u_elif'), `posts/${id}/a.jpg`, { customMetadata: { clubId: 'c01' } }));
    await assertFails(up(st('u_burak'), `posts/${id}/b.jpg`, { customMetadata: { clubId: 'c01' } }));
    await assertFails(up(st('u_elif'), `posts/${id}/c.jpg`));
    await assertFails(up(st('u_elif'), `posts/${id}/d.jpg`, { customMetadata: { clubId: 'c02' } }));
  });
  test('etkinlik kapağı: kulübün yöneticisi yükler, başka kulübün yöneticisi yükleyemez', async () => {
    await assertSucceeds(up(st('u_elif'), `events/e01/t-${rnd()}.jpg`));
    await assertFails(up(st('u_p_c02'), `events/e01/t-${rnd()}.jpg`));
    await assertFails(up(st('u_elif'), `events/yok-${rnd()}/t.jpg`));
  });
  test('kulüp logosu: yönetici ve süper yükler, üye yükleyemez', async () => {
    await assertSucceeds(up(st('u_elif'), `clubs/c01/t-${rnd()}.jpg`));
    await assertSucceeds(up(st('u_admin', { superadmin: true }), `clubs/c01/t-${rnd()}.jpg`));
    await assertFails(up(st('u_burak'), `clubs/c01/t-${rnd()}.jpg`));
  });
  test('destek eki geçerli talep numarasıyla, okuma yalnız süper', async () => {
    const { getBytes } = await import('firebase/storage');
    const p = `support/GU-ABC234/t-${rnd()}.jpg`;
    await assertSucceeds(up(st('u_burak'), p));
    await assertFails(up(st('u_burak'), `support/kotu/t-${rnd()}.jpg`));
    await assertFails(getBytes(sref(st('u_burak'), p)));
    await assertSucceeds(getBytes(sref(st('u_admin', { superadmin: true }), p)));
  });
  test('silme her yolda kapalı', async () => {
    const { deleteObject } = await import('firebase/storage');
    const p = `users/u_burak/t-${rnd()}.jpg`;
    await assertSucceeds(up(st('u_burak'), p));
    await assertFails(deleteObject(sref(st('u_burak'), p)));
  });
});

test('sağlama: seed belgesi okunabilir', async () => {
  const s = await getDoc(doc(as('memb'), 'clubs', 'c1'));
  assert.equal(s.data().name, 'Yazılım');
});
