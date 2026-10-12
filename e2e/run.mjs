// Uçtan uca tarayıcı testleri — Firebase emülatörü + `npm run dev:emu` üzerinde çalışır.
//   npm run e2e                 → tüm senaryolar
//   npm run e2e -- --only=admin → adında "admin" geçen senaryolar
//   npm run e2e -- --reset      → önce emülatör verisini temizleyip demo verisini yeniden yükler (yalnız demo-* projesi)
// Ortam: E2E_URL (varsayılan http://localhost:5173), E2E_CHROME (Chromium yolu), GU_SEED_SCRIPT (Flutter deposundaki seed_emulator.js).
// Her senaryo kendi tarayıcı bağlamında koşar; konsolda izin hatası (permission-denied), yakalanmamış hata ya da
// "Bir şeyler ters gitti" ekranı görülürse senaryo başarısız sayılır. Başarısız adımın ekran görüntüsü e2e/out/ altına yazılır.
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'e2e', 'out');
mkdirSync(OUT, { recursive: true });
const URL0 = process.env.E2E_URL || 'http://localhost:5173';
const PROJECT = 'demo-gu-kulupler';
const CHROME = process.env.E2E_CHROME || ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const args = process.argv.slice(2);
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
const SLOW = +(process.env.E2E_SLOW || 1);
const SHOTS = args.includes('--shots');
if (SHOTS) mkdirSync(path.join(OUT, 'screens'), { recursive: true });

/* ---------------- emülatör verisi ---------------- */
async function resetEmulator() {
  if (!PROJECT.startsWith('demo-')) throw new Error('reset yalnız demo projelerinde');
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  const seed = process.env.GU_SEED_SCRIPT || [path.resolve(ROOT, '..', 'gu_kulupler', 'tool', 'seed', 'seed_emulator.js'), '/mnt/project-files/gu_kulupler/tool/seed/seed_emulator.js'].find((f) => existsSync(f)) || 'seed_emulator.js';
  if (!existsSync(seed)) throw new Error('seed betiği bulunamadı: ' + seed + ' (GU_SEED_SCRIPT ile verin)');
  execFileSync('node', [seed, '--project', PROJECT], {
    cwd: path.resolve(path.dirname(seed), '..', '..'), stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199' },
  });
}
/** Emülatör yönetici REST'i ile tek belge okur (doğrulama için; kurallar devre dışı). */
async function fsGet(docPath) {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`, { headers: { Authorization: 'Bearer owner' } });
  if (r.status === 404) return null;
  const j = await r.json(); const out = {};
  for (const [k, v] of Object.entries(j.fields || {})) out[k] = v.integerValue !== undefined ? +v.integerValue : v.stringValue ?? v.booleanValue ?? v.timestampValue ?? (v.nullValue !== undefined ? null : v.mapValue ? v.mapValue.fields : v.arrayValue ? (v.arrayValue.values || []) : v);
  return out;
}
async function fsQueryCount(collection, field, value, and) {
  const f = (fp, v) => ({ fieldFilter: { field: { fieldPath: fp }, op: 'EQUAL', value: { stringValue: v } } });
  const where = and ? { compositeFilter: { op: 'AND', filters: [f(field, value), f(and.field, and.value)] } } : f(field, value);
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`, {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where } }),
  });
  return (await r.json()).filter((x) => x.document).length;
}
/** AUT-03: e-posta doğrulama bağlantısını emülatörden alıp açar. */
async function verifyEmailOob(email) {
  const r = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/oobCodes`);
  const codes = (await r.json()).oobCodes.filter((c) => c.email === email && c.requestType === 'VERIFY_EMAIL');
  if (!codes.length) throw new Error('doğrulama kodu yok: ' + email);
  await fetch(codes[codes.length - 1].oobLink.replace('127.0.0.1:9099', '127.0.0.1:9099'));
}

/* ---------------- tarayıcı yardımcıları ---------------- */
let browser;
const results = [];
class Ctx {
  constructor(name, page, ctx) { this.name = name; this.p = page; this.ctx = ctx; this.logs = []; this.problems = []; this.stepNo = 0; }
  static async open(name, { w = 390, h = 844, theme = 'light' } = {}) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', colorScheme: theme });
    const p = await ctx.newPage();
    const c = new Ctx(name, p, ctx);
    p.on('console', (m) => {
      const t = m.text();
      if (['error', 'warning'].includes(m.type())) c.logs.push(m.type() + ': ' + t.slice(0, 300));
      if (/permission-denied|Missing or insufficient permissions/i.test(t)) c.problems.push('İZİN HATASI: ' + t.slice(0, 300));
    });
    p.on('pageerror', (e) => c.problems.push('SAYFA HATASI: ' + e.message));
    await p.goto(URL0 + '/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    return c;
  }
  async step(label, fn) {
    this.stepNo++;
    try { await fn(); }
    catch (e) {
      const shot = path.join(OUT, `${this.name}-${this.stepNo}.png`.replace(/[^\w.-]/g, '_'));
      await this.p.screenshot({ path: shot }).catch(() => {});
      const acts = await this.visibleActions().catch(() => []);
      throw new Error(`[${this.name}] adım ${this.stepNo} "${label}": ${e.message}\n   URL: ${this.p.url()}\n   görünür eylemler: ${acts.slice(0, 60).join(' ')}\n   ekran: ${shot}`);
    }
    if (this.problems.length) throw new Error(`[${this.name}] adım ${this.stepNo} "${label}" sonrası:\n   ${this.problems.join('\n   ')}`);
    const sys = await this.p.$('[data-screen="SYS-02"]');
    if (sys) throw new Error(`[${this.name}] adım ${this.stepNo} "${label}": hata ekranı (SYS-02) göründü`);
  }
  visibleActions() { return this.p.$$eval('[data-action]', (es) => [...new Set(es.filter((e) => e.getClientRects().length).map((e) => e.dataset.action))]); }
  sel(a) { return a.startsWith('[') || a.startsWith('.') || a.includes(' ') ? a : `[data-action="${a}"]`; }
  async click(a, { timeout = 10000, force = false } = {}) { await this.p.click(this.sel(a), { timeout, force }); await this.p.waitForTimeout(500 * SLOW); }
  async fill(a, v) { await this.p.fill(this.sel(a), v); await this.p.waitForTimeout(150); }
  async has(a, timeout = 8000) { return !!(await this.p.waitForSelector(this.sel(a), { timeout, state: 'visible' }).catch(() => null)); }
  async expect(a, timeout = 10000) { if (!(await this.has(a, timeout))) throw new Error('beklenen öğe yok: ' + a); }
  async expectNot(a, timeout = 1500) { if (await this.has(a, timeout)) throw new Error('olmaması gereken öğe var: ' + a); }
  async text() { return (await this.p.innerText('body')).replace(/\s+/g, ' '); }
  async expectText(re, timeout = 10000) {
    const t0 = Date.now();
    for (;;) { const t = await this.text(); if (re.test(t)) return t; if (Date.now() - t0 > timeout) throw new Error('metin bulunamadı: ' + re + ' — sayfa: ' + t.slice(0, 300)); await this.p.waitForTimeout(300); }
  }
  async toast(timeout = 12000) {
    const el = await this.p.waitForSelector('[data-toast]', { timeout }).catch(() => null);
    if (!el) throw new Error('bildirim (toast) çıkmadı');
    const r = { id: await el.getAttribute('data-toast'), text: (await el.innerText()).replace(/\s+/g, ' ') };
    return r;
  }
  async expectToast(id, timeout) { const t = await this.toast(timeout); if (!String(t.id).startsWith(id)) throw new Error(`beklenen toast ${id}, gelen ${t.id}: ${t.text}`); return t; }
  async closeToasts() { await this.p.evaluate(() => document.querySelectorAll('[data-toast] [data-action$=".close"]').forEach((b) => b.click())).catch(() => {}); await this.p.waitForTimeout(300); }
  async go(route) {
    await this.p.evaluate((pp) => { history.pushState({}, '', pp); dispatchEvent(new PopStateEvent('popstate')); }, route);
    await this.p.waitForTimeout(1800 * SLOW);
  }
  async login(uid) {
    await this.click('ONB-01.skip').catch(() => {});
    await this.click(`AUT-01.demoAccount.${uid}`);
    await this.p.waitForSelector('[data-action^="NAV.tab."], [data-action^="NAV.side."]', { timeout: 20000 });
    await this.p.waitForTimeout(1200);
  }
  async close() { await this.ctx.close(); }
}

/* ---------------- senaryolar ---------------- */
const SC = [];
const scenario = (name, fn) => SC.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// 1 — her rolün açabildiği tüm ekranlar hatasız yüklenir (mobil + masaüstü + koyu tema)
const SWEEP = {
  u_ayse: ['/clubs', '/clubs/search', '/clubs/c01', '/clubs/c04', '/clubs/c04/members', '/clubs/c04/feed', '/events', '/events/e01', '/events/mine',
    '/notifications', '/settings/notifications', '/profile', '/profile/edit', '/profile/clubs', '/profile/saved', '/settings', '/settings/blocked',
    '/settings/delete', '/settings/about', '/settings/support', '/users/u_mehmet', '/legal/kvkk', '/not-found', '/clubs/yok-boyle-kulup', '/events/yok'],
  u_mehmet: ['/clubs/c01', '/clubs/c01/feed', '/clubs/c01/posts/p01', '/clubs/c01/members', '/clubs/c06/application', '/clubs/c05', '/events/e01', '/events/e01/ticket', '/events/e02', '/events/mine', '/profile/saved'],
  u_elif: ['/manage/c01', '/manage/c01/applications', '/manage/c01/members', '/manage/c01/events', '/manage/c01/events/new', '/manage/c01/events/e01/attendance',
    '/manage/c01/events/e01/scan', '/manage/c01/content', '/manage/c01/settings', '/manage/c01/activity', '/clubs/c01/compose', '/manage/c02'],
  u_zeynep: ['/manage/c01', '/manage/c01/applications', '/manage/c01/members', '/manage/c01/events', '/manage/c01/activity', '/manage/c02', '/clubs/c01/feed'],
  u_admin: ['/admin', '/admin/clubs', '/admin/clubs/new', '/admin/clubs/c01/edit', '/admin/reports', '/admin/users', '/clubs/c14', '/manage/c01'],
};
for (const [uid, routes] of Object.entries(SWEEP)) {
  for (const vp of [{ w: 390, h: 844, theme: 'light' }, { w: 1280, h: 860, theme: 'dark' }]) {
    scenario(`ekran taraması ${uid} ${vp.w}px ${vp.theme}`, async () => {
      const c = await Ctx.open(`sweep-${uid}-${vp.w}`, vp);
      try {
        await c.step('giriş', () => c.login(uid));
        for (const r of routes) {
          await c.step('aç ' + r, async () => {
            await c.go(r);
            const sw = await c.p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            assert(sw <= 1, `yatay taşma ${sw}px`);
            if (SHOTS) await c.p.screenshot({ path: path.join(OUT, 'screens', `${uid}-${vp.w}-${r.replace(/\//g, '_') || 'root'}.png`) });
          });
        }
      } finally { await c.close(); }
    });
  }
}

// 2 — anında katılım ve ayrılma (sayaç doğrulamalı)
scenario('öğrenci: anında katıl → ayrıl', async () => {
  const c = await Ctx.open('instant');
  try {
    const before = (await fsGet('clubs/c09')).memberCount;
    await c.step('giriş', () => c.login('u_ayse'));
    await c.step('kulübe git', () => c.go('/clubs/c09'));
    await c.step('katıl', async () => { await c.click('CLB-03.join.c09'); await c.expectToast('TST-34'); });
    await c.step('sayaç +1', async () => {
      const m = await fsGet('memberships/c09_u_ayse'); assert(m && m.status === 'active', 'üyelik aktif değil');
      assert((await fsGet('clubs/c09')).memberCount === before + 1, 'memberCount artmadı');
    });
    await c.step('ayrıl', async () => {
      await c.closeToasts();
      await c.click('CLB-03.menu'); await c.click('SHT-06.leave'); await c.click('DLG-08.confirm');
      await c.p.waitForTimeout(1500);
    });
    await c.step('sayaç −1', async () => {
      assert((await fsGet('memberships/c09_u_ayse')).status === 'left', 'üyelik left değil');
      assert((await fsGet('clubs/c09')).memberCount === before, 'memberCount geri dönmedi');
    });
    await c.step('yeniden katıl (M3)', async () => { await c.go('/clubs/c09'); await c.click('CLB-03.join.c09'); await c.expectToast('TST-34'); });
  } finally { await c.close(); }
});

// 3 — onaylı kulübe başvuru → başvuruyu düzenle → geri çek
scenario('öğrenci: başvur → not düzenle → geri çek', async () => {
  const c = await Ctx.open('apply');
  try {
    await c.step('giriş', () => c.login('u_ayse'));
    await c.step('kulübe git', () => c.go('/clubs/c02'));
    await c.step('başvuru formu', async () => {
      await c.click('CLB-03.join.c02');
      await c.fill('SHT-05.note', 'Merhaba, kulübe katılmak istiyorum.');
      await c.click('SHT-05.submit');
    });
    await c.step('başvuru alındı ekranı', async () => {
      await c.p.waitForTimeout(1500);
      const m = await fsGet('memberships/c02_u_ayse'); assert(m && m.status === 'pending', 'başvuru pending değil');
      assert(await fsGet('memberships/c02_u_ayse/private/contact'), 'iletişim belgesi yok');
    });
    await c.step('başvurum', () => c.go('/clubs/c02/application'));
    await c.step('notu düzenle', async () => {
      if (await c.has('CLB-05.note', 3000)) { await c.fill('CLB-05.note', 'Güncellenmiş not.'); await c.click('CLB-05.saveNote'); await c.p.waitForTimeout(1200);
        assert((await fsGet('memberships/c02_u_ayse')).note === 'Güncellenmiş not.', 'not güncellenmedi'); }
    });
    await c.step('geri çek', async () => {
      await c.go('/clubs/c02/application');
      await c.click('CLB-05.cancel'); await c.click('[data-action$=".confirm"]'); await c.p.waitForTimeout(1500);
      assert((await fsGet('memberships/c02_u_ayse')).status === 'cancelled', 'başvuru geri çekilmedi');
    });
  } finally { await c.close(); }
});

// 4 — üye: beğen, yorum yap, oy ver, kaydet, etkinliğe katıl / ayrıl, bilet
scenario('üye: gönderi etkileşimleri', async () => {
  const c = await Ctx.open('member-feed');
  try {
    await c.step('giriş', () => c.login('u_mehmet'));
    await c.step('akış', async () => { await c.go('/clubs/c01'); await c.click('CLB-03.tab.posts'); await c.expect('FED-01.like.p03'); });
    const likes0 = (await fsGet('posts/p03')).likeCount;
    await c.step('beğen', async () => { await c.click('FED-01.like.p03'); await c.p.waitForTimeout(1200); assert((await fsGet('posts/p03')).likeCount === likes0 + 1, 'beğeni sayılmadı'); });
    await c.step('beğeniyi geri al', async () => { await c.click('FED-01.like.p03'); await c.p.waitForTimeout(1200); assert((await fsGet('posts/p03')).likeCount === likes0, 'beğeni geri alınmadı'); });
    await c.step('kaydet', async () => {
      const was = await fsGet('savedPosts/u_mehmet_p03');
      if (was && was.isDeleted === false) { await c.click('FED-01.save.p03'); await c.p.waitForTimeout(1200); }
      await c.click('FED-01.save.p03'); await c.p.waitForTimeout(1200);
      const s = await fsGet('savedPosts/u_mehmet_p03'); assert(s && s.isDeleted === false, 'kaydedilmedi');
    });
    await c.step('ankete oy ver', async () => {
      if (await fsGet('posts/p04/votes/u_mehmet')) return; // önceki koşumda verilmiş
      await c.click('FED-01.vote.p04.o2'); await c.p.waitForTimeout(1500);
      const v = await fsGet('posts/p04/votes/u_mehmet'); assert(v && v.optionId === 'o2', 'oy yazılmadı');
    });
    await c.step('gönderi ayrıntısı + yorum', async () => {
      const n0 = (await fsGet('posts/p03')).commentCount;
      await c.click('FED-01.post.p03');
      await c.fill('FED-02.commentInput', 'E2E test yorumu');
      await c.click('FED-02.sendComment'); await c.p.waitForTimeout(1500);
      await c.expectText(/E2E test yorumu/);
      assert((await fsGet('posts/p03')).commentCount === n0 + 1, 'yorum sayacı artmadı');
    });
    await c.step('kaydedilenler', async () => { await c.go('/profile/saved'); await c.expect('PRF-04.post.p03'); });
  } finally { await c.close(); }
});

scenario('üye: etkinliğe katıl → bilet → ayrıl', async () => {
  const c = await Ctx.open('member-event');
  try {
    await c.step('giriş', () => c.login('u_ayse'));
    const g0 = (await fsGet('events/e04')).goingCount;
    await c.step('etkinlik', () => c.go('/events/e04'));
    await c.step('katıl', async () => {
      await c.click('EVT-02.join');
      if (await c.has('SHT-12.confirm', 3000)) await c.click('SHT-12.confirm');
      await c.p.waitForTimeout(1500);
      const r = await fsGet('rsvps/e04_u_ayse'); assert(r && r.status === 'going', 'kayıt going değil');
      assert(/^GU-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(r.ticketCode), 'bilet kodu biçimi');
      assert((await fsGet('events/e04')).goingCount === g0 + 1, 'goingCount artmadı');
    });
    await c.step('bilet', async () => { await c.go('/events/e04/ticket'); await c.expectText(/GU-[A-Z0-9]{4}-[A-Z0-9]{4}/); });
    await c.step('etkinliklerim', async () => { await c.go('/events/mine'); await c.expect('EVT-04.event.e04'); });
    await c.step('ayrıl', async () => {
      await c.go('/events/e04'); await c.click('EVT-02.leave'); await c.click('[data-action$=".confirm"]'); await c.p.waitForTimeout(1500);
      assert((await fsGet('rsvps/e04_u_ayse')).status === 'cancelled', 'kayıt iptal edilmedi');
      assert((await fsGet('events/e04')).goingCount === g0, 'goingCount geri dönmedi');
    });
  } finally { await c.close(); }
});

// 5 — yönetim kurulu: başvuru onayı, gönderi, etkinlik oluşturma + yoklama (iki kullanıcı)
scenario('yönetim: başvuru onayla (+1) ve geri al', async () => {
  const c = await Ctx.open('approve');
  try {
    const before = (await fsGet('clubs/c01')).memberCount;
    await c.step('giriş', () => c.login('u_elif'));
    await c.step('başvurular', () => c.go('/manage/c01/applications'));
    let uid;
    await c.step('onayla', async () => {
      const a = await c.p.$eval('[data-action^="MGT-02.approve."]', (e) => e.dataset.action);
      uid = a.split('.').pop();
      await c.click(a); await c.expectToast('TST-27');
      assert((await fsGet(`memberships/c01_${uid}`)).status === 'active', 'onaylanmadı');
      assert((await fsGet('clubs/c01')).memberCount === before + 1, 'memberCount artmadı');
      assert(await fsGet(`activity`) !== undefined, '');
    });
    await c.step('geri al', async () => {
      await c.click('[data-toast] button'); await c.p.waitForTimeout(2000);
      assert((await fsGet(`memberships/c01_${uid}`)).status === 'pending', 'geri alınmadı');
      assert((await fsGet('clubs/c01')).memberCount === before, 'memberCount geri dönmedi');
    });
  } finally { await c.close(); }
});

scenario('yönetim: gönderi paylaş, sabitle, sil', async () => {
  const c = await Ctx.open('compose');
  try {
    await c.step('giriş', () => c.login('u_elif'));
    await c.step('oluştur', async () => {
      await c.go('/clubs/c01/compose');
      await c.fill('FED-03.text', 'E2E web gönderisi ' + Date.now());
      await c.click('FED-03.publish');
      await c.p.waitForTimeout(2500);
    });
    await c.step('akışta görünür', async () => { await c.go('/clubs/c01'); await c.click('CLB-03.tab.posts'); await c.expectText(/E2E web gönderisi/); });
    await c.step('içerik yönetiminde sil', async () => {
      await c.go('/manage/c01/content');
      const del = await c.p.$eval('[data-action^="MGT-08.menu."]', (e) => e.dataset.action);
      await c.click(del);
      await c.click('[data-action^="MGT-08.delete."]');
      if (await c.has('[data-action$=".confirm"]', 2500)) await c.click('[data-action$=".confirm"]');
      await c.p.waitForTimeout(1500);
    });
  } finally { await c.close(); }
});

scenario('yönetim: bildirimli duyuru + günlük sınır', async () => {
  const c = await Ctx.open('announce');
  try {
    await c.step('giriş', () => c.login('u_elif'));
    const key = (() => { const d = new Date(Date.now() + 3 * 36e5); return d.toISOString().slice(0, 10).replace(/-/g, ''); })();
    const before = (await fsGet(`announcementCounters/c01_${key}`))?.count || 0;
    if (before >= 2) return; // bugünün hakkı önceki koşumlarda bitti
    await c.step('duyuru yaz', async () => {
      await c.go('/clubs/c01/compose');
      await c.click('FED-03.type.announcement');
      await c.fill('FED-03.title', 'E2E duyuru');
      await c.fill('FED-03.text', 'Bildirimli test duyurusu');
      const on = await c.p.$eval('[data-action="FED-03.pushToggle"]', (e) => e.getAttribute('aria-checked') || (e.querySelector('input')?.checked ? 'true' : 'false'));
      if (on !== 'true') await c.click('FED-03.pushToggle');
      await c.click('FED-03.publish');
      if (await c.has('[data-action^="DLG-"][data-action$=".confirm"]', 3000)) await c.click('[data-action^="DLG-"][data-action$=".confirm"]');
      await c.p.waitForTimeout(4000);
    });
    await c.step('sayaç ve bildirimler', async () => {
      const ctr = await fsGet(`announcementCounters/c01_${key}`);
      assert(ctr && ctr.count === before + 1, 'günlük sayaç artmadı');
      const postId = ctr.lastPostRef.split('/')[1];
      const p = await fsGet('posts/' + postId); assert(p.type === 'announcement' && p.pushSent === true, 'duyuru yazılmadı');
      const n = await fsQueryCount('notifications', 'type', 'announcement', { field: 'refs.postId', value: postId });
      assert(n >= 50, 'duyuru bildirimleri dağıtılmadı: ' + n);
    });
  } finally { await c.close(); }
});

scenario('yönetim + üye: etkinlik oluştur → katıl → elle bilet kodu ile yoklama', async () => {
  const mgr = await Ctx.open('event-mgr');
  const mem = await Ctx.open('event-mem');
  try {
    await mgr.step('giriş (yönetim)', () => mgr.login('u_elif'));
    let eventId;
    await mgr.step('etkinlik formu', async () => {
      await mgr.go('/manage/c01/events/new');
      await mgr.fill('MGT-05.title', 'E2E Hızlı Buluşma');
      await mgr.fill('MGT-05.desc', 'Uçtan uca test etkinliği');
      await mgr.click('MGT-05.next');
      // başlangıç ≈ 1 saat sonra (yoklama penceresi içinde), bitiş 2 saat sonra — İstanbul saatiyle
      const ist = (ms) => { const d = new Date(ms + 3 * 36e5); return { day: d.toISOString().slice(0, 10), h: d.getUTCHours(), m: d.getUTCMinutes() }; };
      const st = Math.ceil((Date.now() + 65 * 60e3) / 300e3) * 300e3;
      const a = ist(st), b = ist(st + 2 * 36e5);
      const pick = async (dateSel, timeSel, v) => {
        await mgr.click(dateSel); await mgr.click(`SHT-28.day.${v.day}`); await mgr.click('SHT-28.ok');
        await mgr.click(timeSel); await mgr.click(`SHT-29.hour.${v.h}`); await mgr.click(`SHT-29.minute.${v.m}`); await mgr.click('SHT-29.ok');
      };
      await pick('MGT-05.startDate', 'MGT-05.startTime', a);
      await pick('MGT-05.endDate', 'MGT-05.endTime', b);
      await mgr.click('MGT-05.place'); await mgr.click('SHT-30.select.pl01');
      await mgr.click('MGT-05.next');
      await mgr.click('MGT-05.publish');
      await mgr.expect('[data-action="DLG-22.notify"][aria-checked="true"]', 15000); // varsayılan: üyelere bildir
      await mgr.click('DLG-22.confirm');
      await mgr.p.waitForTimeout(3000);
    });
    await mgr.step('etkinlik listesinde', async () => {
      await mgr.go('/manage/c01/events');
      eventId = await mgr.p.$$eval('[data-action^="MGT-04.event."]', (es) => es.map((e) => e.dataset.action.split('.').pop()))
        .then(async (ids) => { for (const id of ids) { const e = await fsGet('events/' + id); if (e && e.title === 'E2E Hızlı Buluşma' && e.status === 'published') return id; } return null; });
      assert(eventId, 'yayınlanan etkinlik bulunamadı');
    });
    await mem.step('giriş (üye)', () => mem.login('u_mehmet'));
    let code;
    await mem.step('katıl', async () => {
      await mem.go('/events/' + eventId); await mem.click('EVT-02.join');
      if (await mem.has('SHT-12.confirm', 3000)) await mem.click('SHT-12.confirm');
      await mem.p.waitForTimeout(1500);
      code = (await fsGet(`rsvps/${eventId}_u_mehmet`)).ticketCode;
      assert(code, 'bilet yok');
      const notified = await fsQueryCount('notifications', 'type', 'event_new', { field: 'refs.eventId', value: eventId });
      assert(notified >= 50, 'event_new bildirimleri dağıtılmadı: ' + notified);
    });
    await mgr.step('elle kod gir', async () => {
      await mgr.go(`/manage/c01/events/${eventId}/scan`);
      if (await mgr.has('MGT-07.manualCode', 3000)) await mgr.click('MGT-07.manualCode');
      await mgr.fill('MGT-07.codeInput', code);
      await mgr.click('MGT-07.verify'); await mgr.p.waitForTimeout(2000);
      assert((await fsGet(`rsvps/${eventId}_u_mehmet`)).status === 'attended', 'yoklama alınmadı');
      assert((await fsGet(`events/${eventId}`)).attendedCount === 1, 'attendedCount 1 değil');
    });
    await mgr.step('aynı kod ikinci kez', async () => {
      await mgr.go(`/manage/c01/events/${eventId}/scan`);
      if (await mgr.has('MGT-07.manualCode', 3000)) await mgr.click('MGT-07.manualCode');
      await mgr.fill('MGT-07.codeInput', code); await mgr.click('MGT-07.verify'); await mgr.p.waitForTimeout(1500);
      await mgr.expectText(/zaten|önceden|daha önce/i);
    });
  } finally { await mgr.close(); await mem.close(); }
});

// 6 — danışman salt okunur
scenario('danışman: yönetim paneli salt okunur', async () => {
  const c = await Ctx.open('advisor');
  try {
    await c.step('giriş', () => c.login('u_zeynep'));
    await c.step('başvurular: onay düğmesi yetki uyarısı verir', async () => {
      await c.go('/manage/c01/applications');
      const a = await c.p.$eval('[data-action^="MGT-02.approve."]', (e) => e.dataset.action); const uid = a.split('.').pop();
      await c.click(a, { force: true }); await c.expectToast('TST-26');
      assert((await fsGet(`memberships/c01_${uid}`)).status === 'pending', 'danışman onaylayabildi');
    });
    await c.step('salt okunur bandı', async () => { await c.go('/manage/c01/members'); await c.expectText(/salt okunur|yalnızca görüntüleyebilir|görüntüleme/i); });
    await c.step('etkinlik oluşturma kapalı', async () => { await c.go('/manage/c01/events'); await c.expectNot('MGT-04.create'); });
  } finally { await c.close(); }
});

// 7 — süper yönetici: kullanıcı askıya al / etkinleştir, bildirimi kapat
scenario('süper yönetici: kullanıcı askı + bildirim çözümü', async () => {
  const c = await Ctx.open('admin');
  try {
    await c.step('giriş', () => c.login('u_admin'));
    await c.step('kullanıcılar', async () => { await c.go('/admin/users'); await c.fill('ADM-05.search', 'burak'); await c.p.waitForTimeout(1500); await c.expect('[data-action^="ADM-05.menu."]'); });
    await c.step('önceki koşumdan kalan askıyı kaldır', async () => {
      if ((await fsGet('users/u_burak')).status !== 'suspended') return;
      await c.click('ADM-05.menu.u_burak'); await c.click('ADM-05.menu.u_burak.suspend'); await c.click('DLG-30.confirm'); await c.p.waitForTimeout(1500);
    });
    await c.step('askıya al', async () => {
      await c.click('ADM-05.menu.u_burak');
      await c.click('ADM-05.menu.u_burak.suspend');
      await c.fill('DLG-30.reason', 'E2E test askısı'); await c.click('DLG-30.confirm'); await c.p.waitForTimeout(1500);
      assert((await fsGet('users/u_burak')).status === 'suspended', 'askıya alınmadı');
    });
    await c.step('etkinleştir', async () => {
      await c.click('ADM-05.menu.u_burak');
      await c.click('ADM-05.menu.u_burak.suspend');
      if (await c.has('DLG-30.confirm', 2000)) await c.click('DLG-30.confirm');
      await c.p.waitForTimeout(1500);
      assert((await fsGet('users/u_burak')).status === 'active', 'etkinleştirilmedi');
    });
    await c.step('bildirimler', async () => { await c.go('/admin/reports'); await c.expect('[data-action^="ADM-04.row."]'); });
    await c.step('bildirimi kapat', async () => {
      await c.click('[data-action^="ADM-04.row."]'); await c.click('SHT-26.closeReport');
      if (await c.has('[data-action$=".confirm"]', 2000)) await c.click('[data-action$=".confirm"]');
      await c.p.waitForTimeout(2000);
    });
  } finally { await c.close(); }
});

// 8 — kayıt ol → e-postayı doğrula → profil kur → hesabı sil
scenario('yeni kullanıcı: kayıt → doğrulama → profil → hesap silme', async () => {
  const c = await Ctx.open('register');
  const email = `e2e.${Date.now().toString(36)}@ogr.gumushane.edu.tr`;
  const pass = 'E2eTest!2026';
  try {
    await c.step('kayıt formu', async () => {
      await c.click('ONB-01.skip').catch(() => {});
      await c.click('AUT-01.register');
      await c.fill('AUT-02.name', 'Test Kullanıcı');
      await c.fill('AUT-02.email', email);
      await c.fill('AUT-02.password', pass);
      await c.fill('AUT-02.password2', pass);
      await c.click('AUT-02.legalCheck');
      await c.click('AUT-02.submit');
      await c.expect('AUT-03.confirm', 15000);
    });
    await c.step('e-posta doğrula', async () => { await verifyEmailOob(email); await c.click('AUT-03.confirm'); await c.expect('AUT-05.next', 15000); });
    await c.step('profil kurulumu', async () => {
      const pickFirst = async () => { await c.p.waitForSelector('[data-action^="SHT-"][data-action*=".select."]', { timeout: 5000 }); await c.click('[data-action^="SHT-"][data-action*=".select."] >> nth=0'); };
      for (let i = 0; i < 6; i++) {
        if (await c.p.$('[data-action^="NAV.tab."], [data-action^="NAV.side."]')) break;
        if (await c.has('AUT-05.department', 800)) { await c.click('AUT-05.department'); await pickFirst(); await c.click('AUT-05.year'); await pickFirst(); }
        if (await c.has('[data-action^="AUT-05.toggleInterest."]', 800)) await c.click('[data-action^="AUT-05.toggleInterest."] >> nth=0');
        if (await c.has('AUT-05.finish', 500)) { await c.click('AUT-05.finish'); continue; }
        if (await c.has('AUT-05.skipPhoto', 500)) { await c.click('AUT-05.skipPhoto'); continue; }
        await c.click('AUT-05.next');
      }
      await c.p.waitForSelector('[data-action^="NAV.tab."], [data-action^="NAV.side."]', { timeout: 15000 });
    });
    await c.step('profil belgesi tamam', async () => {
      const uid = await c.p.evaluate(() => JSON.parse(Object.entries(localStorage).find(([k]) => k.startsWith('firebase:authUser'))?.[1] || '{}').uid);
      c.uid = uid; const u = await fsGet('users/' + uid);
      assert(u && u.profileComplete === true && u.status === 'active', 'profil tamamlanmadı');
    });
    await c.step('kulübe katıl (silmede temizlenecek)', async () => { await c.go('/clubs/c12'); await c.click('CLB-03.join.c12'); await c.p.waitForTimeout(1500); });
    await c.step('hesabı sil', async () => {
      await c.go('/settings/delete');
      for (let i = 0; i < 4 && !(await c.has('SET-03.confirm', 800)); i++) {
        if (await c.has('[data-action^="SET-03.reason."]', 500)) await c.click('SET-03.reason.noUse');
        await c.click('SET-03.next');
      }
      await c.fill('SET-03.password', pass);
      await c.fill('SET-03.confirmWord', 'SİL');
      await c.click('SET-03.confirm');
      await c.expect('[data-action="AUT-01.login"], [data-action="ONB-01.skip"]', 30000);
    });
    await c.step('silme sonrası veriler', async () => {
      const u = await fsGet('users/' + c.uid);
      assert(u.status === 'deleted' && u.isDeleted === true && u.name === 'Silinmiş kullanıcı', 'kullanıcı anonimleşmedi');
      const m = await fsGet(`memberships/c12_${c.uid}`); assert(m.status === 'left', 'üyelik bırakılmadı');
      assert((await fsGet(`users/${c.uid}/private/account`)).email === '', 'e-posta temizlenmedi');
    });
  } finally { await c.close(); }
});

/* ---------------- koşucu ---------------- */
(async () => {
  if (args.includes('--reset')) await resetEmulator();
  browser = await chromium.launch({ executablePath: CHROME });
  const list = SC.filter((s) => !ONLY || s.name.includes(ONLY));
  let ok = 0; const t0 = Date.now();
  for (const s of list) {
    const t = Date.now();
    try { await s.fn(); ok++; console.log(`✔ ${s.name} (${((Date.now() - t) / 1000).toFixed(1)} sn)`); results.push({ name: s.name, ok: true }); }
    catch (e) { console.log(`✘ ${s.name}\n   ${e.message}`); results.push({ name: s.name, ok: false, error: e.message }); }
  }
  await browser.close();
  console.log(`\n${ok}/${list.length} senaryo geçti (${((Date.now() - t0) / 1000).toFixed(0)} sn)`);
  process.exit(ok === list.length ? 0 : 1);
})();
void readFileSync;
