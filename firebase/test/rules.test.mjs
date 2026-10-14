// Web'e özgü (WEB-EK) kural dalları — çalışan emülatöre karşı (npm run test:rules).
// firestore.rules / storage.rules, Flutter deposundaki kuralların kopyası + WEB-EK dallarıdır. Ortak dalların
// (başvuru, katılım, gönderi, etkinlik, bildirim…) testleri Flutter deposundadır (firebase/test, ~4300 test) ve
// bu dosyalara karşı da geçer; burada yalnızca yönetim ve süper admin dalları denenir.
// Her test kendi temiz verisiyle başlar; gerçek projeye hiçbir şey yazılmaz.
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, collection, collectionGroup, query, where, serverTimestamp, increment, Timestamp } from 'firebase/firestore';
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
const superAdmin = () => as('admin', { superadmin: true });

const ago = (ms) => Timestamp.fromMillis(Date.now() - ms);
const later = (ms) => Timestamp.fromMillis(Date.now() + ms);
const S = 1000, H = 36e5, D = 24 * H;
const base = () => ({ createdAt: ago(D), updatedAt: ago(D), isDeleted: false });
const ts = () => serverTimestamp();
const touch = () => ({ updatedAt: ts() });
const create = () => ({ createdAt: ts(), updatedAt: ts(), isDeleted: false });
const KEY = 'AbCdEfGhIjKlMnOpQrSt'; // 20 karakterlik olay anahtarı
const KEY2 = 'ZyXwVuTsRqPoNmLkJiHg';

const user = (id, o = {}) => ({ name: `Kişi ${id}`, nameLower: `kişi ${id}`, avatarSeed: id, department: 'd01', year: '2', interests: ['i01'], bio: '',
  status: 'active', staff: false, profileComplete: true, ...base(), ...o });
const club = (o = {}) => ({ name: 'Yazılım', nameLower: 'yazılım', categoryId: 'k01', iconName: 'code', palette: 'red', pattern: 'mountain', coverSeed: 'club-c1',
  memberCount: 3, approvalRequired: true, applicationsOpen: true, requireNote: false, founded: 2015, summary: 's', about: 'a', conditions: [], social: { email: null, instagram: null, web: null },
  presidentId: 'pres', advisor: { name: 'Dr.', title: 'Dr.', userId: 'adv' }, status: 'active', ...base(), ...o });
const applicant = (u) => ({ name: `Kişi ${u}`, department: 'd01', year: '2', avatarSeed: u });
const mem = (c, u, role, status = 'active', o = {}) => ({ clubId: c, userId: u, status, role, applicant: applicant(u), appliedAt: ago(10 * D), priorCount: 0, ...base(), ...o });

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore(); const b = writeBatch(db);
    for (const u of ['pres', 'board', 'memb', 'adv', 'out', 'pend', 'admin', 'p2']) b.set(doc(db, 'users', u), user(u));
    b.set(doc(db, 'users', 'susp'), user('susp', { status: 'suspended' }));
    b.set(doc(db, 'users', 'memb', 'private', 'account'), { email: `memb${DOMAIN}`, emailLower: `memb${DOMAIN}`, fcmTokens: [], ...base() });
    b.set(doc(db, 'users', 'susp', 'private', 'account'), { email: `susp${DOMAIN}`, emailLower: `susp${DOMAIN}`, fcmTokens: [], suspendReason: 'x', ...base() });
    b.set(doc(db, 'clubs', 'c1'), club());
    b.set(doc(db, 'clubs', 'c2'), club({ name: 'Müzik', nameLower: 'müzik', presidentId: 'p2', memberCount: 1, coverSeed: 'club-c2', advisor: null }));
    b.set(doc(db, 'memberships', 'c1_pres'), mem('c1', 'pres', 'president'));
    b.set(doc(db, 'memberships', 'c1_board'), mem('c1', 'board', 'board'));
    b.set(doc(db, 'memberships', 'c1_memb'), mem('c1', 'memb', 'member'));
    b.set(doc(db, 'memberships', 'c1_adv'), mem('c1', 'adv', 'advisor'));
    b.set(doc(db, 'memberships', 'c1_pend'), mem('c1', 'pend', 'member', 'pending'));
    b.set(doc(db, 'memberships', 'c2_p2'), mem('c2', 'p2', 'president'));
    b.set(doc(db, 'events', 'e1'), { clubId: 'c1', status: 'published', goingCount: 0, waitlistCount: 0, attendedCount: 0, ...base() });
    b.set(doc(db, 'events', 'e1', 'private', 'counter'), { clubId: 'c1', lastRsvpRef: 'rsvps/e1_memb', updatedAt: ago(H) });
    b.set(doc(db, 'reports', 'memb_user_out'), { targetType: 'user', targetId: 'out', reporterId: 'memb', reason: 'spam', note: '', status: 'open', ...base() });
    await b.commit();
  });
}

const club1 = (db) => doc(db, 'clubs', 'c1');
const mref = (db, id) => doc(db, 'memberships', id);
const side = (db, c = 'c1') => doc(db, 'clubs', c, 'private', 'counter');
const pointer = (c, u) => ({ clubId: c, lastMembershipRef: `memberships/${c}_${u}`, updatedAt: ts() });
const decided = (uid) => ({ decidedAt: ts(), decidedBy: uid });
const cooldown = () => later(7 * D);
const notif = (db, type, u) => doc(db, 'notifications', `${type}_${KEY}_${u}`);
const notifData = (type, u, refs) => ({ userId: u, type, refs, read: false, ...create() });
const act = (db, c, actor, kind, key = KEY) => doc(db, 'activity', `${c}_${actor}_${kind}_${key}`);
const actData = (c, actor, kind, refs) => ({ clubId: c, actorId: actor, kind, refs, createdAt: ts() });

/** M5 onay batch'i: üyelik + sayaç + yan belge + günlük + bildirim. */
function approveBatch(db, actor, o = {}) {
  const b = writeBatch(db);
  b.update(mref(db, 'c1_pend'), { status: 'active', role: 'member', ...decided(actor), ...touch() });
  if (!o.noCount) b.update(club1(db), { memberCount: increment(o.step ?? 1), ...touch() });
  if (!o.noSide) b.set(side(db), pointer('c1', o.pointTo ?? 'pend'));
  b.set(act(db, 'c1', actor, 'application_approved'), actData('c1', actor, 'application_approved', { userId: 'pend' }));
  b.set(notif(db, 'application_approved', 'pend'), notifData('application_approved', 'pend', { clubId: 'c1' }));
  return b.commit();
}

/* ===================== yönetici üyelik geçişleri ===================== */
describe('memberships — yönetici (T-30)', () => {
  test('M5 yönetim kurulu onaylar: +1, yan belge, günlük, bildirim tek batch', async () => { await assertSucceeds(approveBatch(as('board'), 'board')); });
  test('M5 yan belge olmadan sayaç artırılamaz', async () => { await assertFails(approveBatch(as('board'), 'board', { noSide: true })); });
  test('M5 sayaçsız onay reddedilir', async () => { await assertFails(approveBatch(as('board'), 'board', { noCount: true })); });
  test('M5 sayaç +2 reddedilir', async () => { await assertFails(approveBatch(as('board'), 'board', { step: 2 })); });
  test('M5 işaretçi başka üyeliği gösteremez', async () => { await assertFails(approveBatch(as('board'), 'board', { pointTo: 'memb' })); });
  test('M5 sıradan üye ve danışman onaylayamaz', async () => {
    await assertFails(approveBatch(as('memb'), 'memb'));
    await assertFails(approveBatch(as('adv'), 'adv'));
  });
  test('M5 başka kulübün başkanı onaylayamaz', async () => { await assertFails(approveBatch(as('p2'), 'p2')); });
  test('M6 reddeder (7 gün), not ≤ 200', async () => {
    const db = as('pres');
    const r = { status: 'rejected', ...decided('pres'), retryAfter: cooldown(), rejectReason: 'quota', rejectNote: null, ...touch() };
    await assertSucceeds(updateDoc(mref(db, 'c1_pend'), r));
  });
  test('M6 bekleme süresi 7 günden kısaysa reddedilir', async () => {
    await assertFails(updateDoc(mref(as('pres'), 'c1_pend'), { status: 'rejected', ...decided('pres'), retryAfter: later(D), rejectReason: 'quota', ...touch() }));
  });
  test('M9 yönetim kurulu üyeyi çıkarır (−1), yönetim kurulunu çıkaramaz', async () => {
    const rm = (db, u, actor) => {
      const b = writeBatch(db);
      b.update(mref(db, `c1_${u}`), { status: 'removed', ...decided(actor), retryAfter: cooldown(), rejectReason: 'other', ...touch() });
      b.update(club1(db), { memberCount: increment(-1), ...touch() });
      b.set(side(db), pointer('c1', u));
      return b.commit();
    };
    await assertFails(rm(as('board'), 'pres', 'board'));
    await assertSucceeds(rm(as('board'), 'memb', 'board'));
  });
  test('M10 başkan rol verir; yönetim kurulu veremez', async () => {
    await assertFails(updateDoc(mref(as('board'), 'c1_memb'), { role: 'board', ...touch() }));
    await assertSucceeds(updateDoc(mref(as('pres'), 'c1_memb'), { role: 'board', ...touch() }));
  });
  test('M10 rol değişikliği danışman ya da başkan yapamaz', async () => {
    await assertFails(updateDoc(mref(as('pres'), 'c1_memb'), { role: 'advisor', ...touch() }));
    await assertFails(updateDoc(mref(as('pres'), 'c1_memb'), { role: 'president', ...touch() }));
  });
  test('M11 devir: iki üyelik + presidentId tek batch', async () => {
    const db = as('pres'); const b = writeBatch(db);
    b.update(mref(db, 'c1_pres'), { role: 'board', ...touch() });
    b.update(mref(db, 'c1_memb'), { role: 'president', ...touch() });
    b.update(club1(db), { presidentId: 'memb', ...touch() });
    await assertSucceeds(b.commit());
  });
  test('M11 devir eski başkan board olmadan reddedilir', async () => {
    const db = as('pres'); const b = writeBatch(db);
    b.update(mref(db, 'c1_memb'), { role: 'president', ...touch() });
    b.update(club1(db), { presidentId: 'memb', ...touch() });
    await assertFails(b.commit());
  });
  test('M12 onayı 30 sn içinde geri alır (−1); süre dolunca alamaz', async () => {
    const put = (ms) => env.withSecurityRulesDisabled((ctx) => setDoc(mref(ctx.firestore(), 'c1_pend'), mem('c1', 'pend', 'member', 'active', { decidedBy: 'board', decidedAt: ago(ms) })));
    const undo = (db, id) => {
      const b = writeBatch(db);
      b.update(mref(db, id), { status: 'pending', decidedAt: null, decidedBy: null, retryAfter: null, rejectReason: null, rejectNote: null, ...touch() });
      b.update(club1(db), { memberCount: increment(-1), ...touch() });
      b.set(side(db), { clubId: 'c1', lastMembershipRef: `memberships/${id}`, updatedAt: ts() });
      return b.commit();
    };
    await put(60 * S); await assertFails(undo(as('board'), 'c1_pend'));
    await put(5 * S); await assertFails(undo(as('pres'), 'c1_pend'));
    await assertSucceeds(undo(as('board'), 'c1_pend'));
  });
});

/* ===================== kulüp ===================== */
describe('clubs — yönetim ve süper admin', () => {
  const settings = (db, uid) => {
    const b = writeBatch(db);
    b.update(club1(db), { summary: 'Yeni özet', applicationsOpen: false, ...touch() });
    b.set(act(db, 'c1', uid, 'settings_changed'), actData('c1', uid, 'settings_changed', {}));
    return b.commit();
  };
  test('yönetici ayarları değiştirir (+ günlük)', async () => { await assertSucceeds(settings(as('board'), 'board')); });
  test('üye ve danışman ayar değiştiremez', async () => {
    await assertFails(settings(as('memb'), 'memb'));
    await assertFails(settings(as('adv'), 'adv'));
  });
  test('yönetici kimlik ya da sayaç değiştiremez', async () => {
    await assertFails(updateDoc(club1(as('pres')), { name: 'Başka', ...touch() }));
    await assertFails(updateDoc(club1(as('pres')), { memberCount: increment(1), ...touch() }));
  });
  test('kulüp belgesine üyelik yolu yazılamaz (CD-137 8q)', async () => {
    await assertFails(updateDoc(club1(as('pres')), { lastMembershipRef: 'memberships/c1_memb', ...touch() }));
  });
  test('yan belge tek başına yazılamaz', async () => { await assertFails(setDoc(side(as('pres')), pointer('c1', 'memb'))); });
  test('süper admin askıya alır (gerekçe zorunlu) ve geri açar', async () => {
    await assertFails(updateDoc(club1(superAdmin()), { status: 'suspended', ...touch() }));
    await assertSucceeds(updateDoc(club1(superAdmin()), { status: 'suspended', suspendReason: 'Kural ihlali', ...touch() }));
    await assertSucceeds(updateDoc(club1(superAdmin()), { status: 'active', suspendReason: null, ...touch() }));
  });
  test('süper olmayan askıya alamaz', async () => { await assertFails(updateDoc(club1(as('pres')), { status: 'suspended', suspendReason: 'x', ...touch() })); });
  test('süper admin kulüp + başkan üyeliği + iletişim oluşturur (tek batch)', async () => {
    const db = superAdmin(); const b = writeBatch(db);
    b.set(doc(db, 'clubs', 'c9'), { ...club({ coverSeed: 'club-c9', memberCount: 1, presidentId: 'out', advisor: null }), ...create() });
    b.set(mref(db, 'c9_out'), { clubId: 'c9', userId: 'out', status: 'active', role: 'president', applicant: applicant('out'), appliedAt: ts(), priorCount: 0, ...create() });
    b.set(doc(db, 'memberships', 'c9_out', 'private', 'contact'), { email: `out${DOMAIN}`, emailLower: `out${DOMAIN}`, note: '', ...create() });
    await assertSucceeds(b.commit());
  });
  test('başkan üyeliği olmadan kulüp oluşturulamaz; süper olmayan oluşturamaz', async () => {
    await assertFails(setDoc(doc(superAdmin(), 'clubs', 'c9'), { ...club({ coverSeed: 'club-c9', memberCount: 1, presidentId: 'out', advisor: null }), ...create() }));
    const db = as('pres'); const b = writeBatch(db);
    b.set(doc(db, 'clubs', 'c9'), { ...club({ coverSeed: 'club-c9', memberCount: 1, presidentId: 'pres', advisor: null }), ...create() });
    b.set(mref(db, 'c9_pres'), { clubId: 'c9', userId: 'pres', status: 'active', role: 'president', applicant: applicant('pres'), appliedAt: ts(), priorCount: 0, ...create() });
    await assertFails(b.commit());
  });
  test('süper admin başkan atar: üye olmayan kullanıcıya +1 ve yan belge', async () => {
    const db = superAdmin(); const b = writeBatch(db);
    b.update(mref(db, 'c1_pres'), { role: 'board', ...touch() });
    b.set(mref(db, 'c1_out'), { clubId: 'c1', userId: 'out', status: 'active', role: 'president', applicant: applicant('out'), appliedAt: ts(), priorCount: 0, ...create() });
    b.update(club1(db), { presidentId: 'out', memberCount: increment(1), ...touch() });
    b.set(side(db), pointer('c1', 'out'));
    await assertSucceeds(b.commit());
  });
  test('kimse kulüp silemez', async () => { await assertFails(deleteDoc(club1(superAdmin()))); });
});

/* ===================== kullanıcı askısı · şikayet · bildirim · günlük ===================== */
describe('süper admin — kullanıcı, şikayet', () => {
  const suspend = (db) => {
    const b = writeBatch(db);
    b.update(doc(db, 'users', 'memb'), { status: 'suspended', ...touch() });
    b.update(doc(db, 'users', 'memb', 'private', 'account'), { suspendReason: 'Spam', ...touch() });
    return b.commit();
  };
  test('askı: durum users\'ta, gerekçe private/account\'ta (tek batch)', async () => { await assertSucceeds(suspend(superAdmin())); });
  test('süper olmayan askıya alamaz', async () => { await assertFails(suspend(as('pres'))); });
  test('gerekçe kullanıcı belgesine yazılamaz (CD-133)', async () => {
    await assertFails(updateDoc(doc(superAdmin(), 'users', 'memb'), { status: 'suspended', suspendReason: 'Spam', ...touch() }));
  });
  test('askıyı kaldırır (gerekçe boşalır)', async () => {
    const db = superAdmin(); const b = writeBatch(db);
    b.update(doc(db, 'users', 'susp'), { status: 'active', ...touch() });
    b.update(doc(db, 'users', 'susp', 'private', 'account'), { suspendReason: null, ...touch() });
    await assertSucceeds(b.commit());
  });
  test('şikayeti çözer + şikayet edene bildirim', async () => {
    const db = superAdmin(); const b = writeBatch(db);
    b.update(doc(db, 'reports', 'memb_user_out'), { status: 'resolved', action: 'dismissed', resolvedAt: ts(), resolvedBy: 'admin', ...touch() });
    b.set(notif(db, 'report_resolved', 'memb'), notifData('report_resolved', 'memb', { reportId: 'memb_user_out' }));
    await assertSucceeds(b.commit());
  });
  test('şikayet çözülmeden report_resolved bildirimi yazılamaz', async () => {
    await assertFails(setDoc(notif(superAdmin(), 'report_resolved', 'memb'), notifData('report_resolved', 'memb', { reportId: 'memb_user_out' })));
  });
  test('süper olmayan şikayet çözemez', async () => {
    await assertFails(updateDoc(doc(as('pres'), 'reports', 'memb_user_out'), { status: 'resolved', action: 'dismissed', resolvedAt: ts(), resolvedBy: 'pres', ...touch() }));
  });
  test('e-posta araması (collectionGroup private) yalnız süper, etkinlik yan belgesi dışarıda', async () => {
    const q = (db) => getDocs(query(collectionGroup(db, 'private'), where('emailLower', '>=', 'memb'), where('emailLower', '<', 'memb')));
    await assertSucceeds(q(superAdmin()));
    await assertFails(q(as('pres')));
    await assertFails(getDocs(collectionGroup(superAdmin(), 'private')));
  });
});

describe('yönetim bildirimi ve günlüğü olaya bağlıdır', () => {
  test('geçiş olmadan application_approved bildirimi yazılamaz', async () => {
    await assertFails(setDoc(notif(as('pres'), 'application_approved', 'memb'), notifData('application_approved', 'memb', { clubId: 'c1' })));
  });
  test('geçiş olmadan yönetici günlüğü yazılamaz', async () => {
    await assertFails(setDoc(act(as('pres'), 'c1', 'pres', 'member_removed'), actData('c1', 'pres', 'member_removed', { userId: 'memb' })));
  });
  test('günlük kimliği başkasının adına olamaz', async () => {
    const db = as('board'); const b = writeBatch(db);
    b.update(mref(db, 'c1_pend'), { status: 'active', role: 'member', ...decided('board'), ...touch() });
    b.update(club1(db), { memberCount: increment(1), ...touch() });
    b.set(side(db), pointer('c1', 'pend'));
    b.set(act(db, 'c1', 'pres', 'application_approved', KEY2), actData('c1', 'board', 'application_approved', { userId: 'pend' }));
    await assertFails(b.commit());
  });
  test('M10 rol + günlük + bildirim tek batch (ifade bütçesi içinde)', async () => {
    const db = as('pres'); const b = writeBatch(db);
    b.update(mref(db, 'c1_memb'), { role: 'board', ...touch() });
    b.set(act(db, 'c1', 'pres', 'role_changed'), actData('c1', 'pres', 'role_changed', { userId: 'memb', role: 'board' }));
    b.set(notif(db, 'role_changed', 'memb'), notifData('role_changed', 'memb', { clubId: 'c1', role: 'board' }));
    await assertSucceeds(b.commit());
  });
  test('M9 çıkarma + günlük + bildirim tek batch', async () => {
    const db = as('pres'); const b = writeBatch(db);
    b.update(mref(db, 'c1_board'), { status: 'removed', ...decided('pres'), retryAfter: cooldown(), rejectReason: 'other', ...touch() });
    b.update(club1(db), { memberCount: increment(-1), ...touch() });
    b.set(side(db), pointer('c1', 'board'));
    b.set(act(db, 'c1', 'pres', 'member_removed'), actData('c1', 'pres', 'member_removed', { userId: 'board' }));
    b.set(notif(db, 'removed_from_club', 'board'), notifData('removed_from_club', 'board', { clubId: 'c1' }));
    await assertSucceeds(b.commit());
  });
  test('role_changed bildirimi yeni rolle eşleşmeli', async () => {
    const db = as('pres'); const b = writeBatch(db);
    b.update(mref(db, 'c1_memb'), { role: 'board', ...touch() });
    b.set(notif(db, 'role_changed', 'memb'), notifData('role_changed', 'memb', { clubId: 'c1', role: 'member' }));
    await assertFails(b.commit());
  });
});

/* ===================== storage ===================== */
// Storage → Firestore çapraz okuması emülatörde yalnızca ana demo projesinde çalışır (singleProjectMode);
// bu yüzden bu bölüm seed verisini (demo-gu-kulupler: c01 yönetim kurulu u_elif, üye u_burak) kullanır.
describe('storage — kulüp görselleri (WEB-EK)', () => {
  let senv;
  before(async () => {
    senv = await initializeTestEnvironment({ projectId: 'demo-gu-kulupler',
      storage: { host: '127.0.0.1', port: 9199, rules: readFileSync(new URL('../storage.rules', import.meta.url), 'utf8') } });
  });
  after(async () => { await senv?.cleanup(); });
  const st = (uid) => senv.authenticatedContext(uid, { email: `${uid}${DOMAIN}`, email_verified: true }).storage();
  const hex = () => Array.from({ length: 16 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  const name = () => `20261014T120000Z_${hex()}.jpg`;
  const img = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const up = (uid, path, md) => uploadBytes(sref(st(uid), path), img(), { contentType: 'image/jpeg', ...(md ? { customMetadata: md } : {}) });
  test('yönetici kendi kulübüne yükler', async () => { await assertSucceeds(up('u_elif', `clubs/c01/${name()}`, { clubId: 'c01', uploaderId: 'u_elif' })); });
  test('üye yükleyemez', async () => { await assertFails(up('u_burak', `clubs/c01/${name()}`, { clubId: 'c01', uploaderId: 'u_burak' })); });
  test('üst veri kulübü klasörle aynı olmalı', async () => { await assertFails(up('u_elif', `clubs/c02/${name()}`, { clubId: 'c01', uploaderId: 'u_elif' })); });
  test('üst verisiz ya da desen dışı ad reddedilir', async () => {
    await assertFails(up('u_elif', `clubs/c01/${name()}`));
    await assertFails(up('u_elif', 'clubs/c01/logo.jpg', { clubId: 'c01', uploaderId: 'u_elif' }));
  });
});

test('sağlama: seed belgesi okunabilir', async () => {
  const s = await getDoc(doc(as('memb'), 'clubs', 'c1'));
  assert.equal(s.data().name, 'Yazılım');
});
