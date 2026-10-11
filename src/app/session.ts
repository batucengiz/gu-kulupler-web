/* Oturum: Firebase Auth dinleyicisi, kullanıcı belgesi, ayarlar ve canlı dinleyiciler (üyeliklerim, bildirim kutusu). */
import { onAuthStateChanged, type User as FbUser } from 'firebase/auth';
import { auth, firebaseConfigured } from '../lib/firebase';
import { Emitter, nav, ui, forms, PUBLIC_SCREENS, parsePath, TAB_OF } from './core';
import { db } from './data';
import { prefs } from './prefs';
import type { User, Settings, Membership, AppNotification, Rsvp } from '../data/models';
import { DEFAULT_SETTINGS } from '../data/models';
import { getUser, createProfile, touchLastLogin, ensureAccountDoc, userCache } from '../data/repo/users';
import { getSettings } from '../data/repo/settings';
import { watchMyMemberships } from '../data/repo/memberships';
import { watchInbox } from '../data/repo/notifications';
import { fetchActiveBlocks } from '../data/repo/blocks';
import { listAllSavedIds } from '../data/repo/saved';
import { listMyRsvps } from '../data/repo/rsvps';
import { fetchActiveClubs } from '../data/repo/clubs';
import { resumeCleanup } from '../data/repo/deletion';
import { isSuperAdmin, signOut } from '../data/repo/auth';
import { trLower } from '../lib/util';
import { reminders } from './reminders';

export interface SessionState {
  ready: boolean;
  fbUser: FbUser | null;
  uid: string | null;
  email: string | null;
  emailVerified: boolean;
  isSuper: boolean;
  user: User | null;
  settings: Settings;
  memberships: Record<string, Membership>;
  membershipsLoaded: boolean;
  blocked: string[];
  inbox: AppNotification[];
  inboxLoaded: boolean;
  savedIds: string[];
  rsvps: Record<string, Rsvp>;
  rsvpsLoaded: boolean;
  listenerError: boolean;
}
const empty = (): SessionState => ({
  ready: false, fbUser: null, uid: null, email: null, emailVerified: false, isSuper: false, user: null, settings: DEFAULT_SETTINGS,
  memberships: {}, membershipsLoaded: false, blocked: [], inbox: [], inboxLoaded: false, savedIds: [], rsvps: {}, rsvpsLoaded: false, listenerError: false,
});

class Session extends Emitter {
  s: SessionState = empty();
  private unsubs: Array<() => void> = [];
  private initial = typeof location !== 'undefined' ? parsePath(location.pathname, location.search) : { screen: 'CLB-01', params: {} };
  private started = false;
  patch(p: Partial<SessionState>) { this.s = { ...this.s, ...p }; this.emit(); }

  init() {
    if (this.started) return; this.started = true;
    if (!firebaseConfigured) { this.patch({ ready: true }); nav.resetTo('SYS-02'); return; }
    onAuthStateChanged(auth, (u) => { void this.onAuth(u); });
  }
  private stopListeners() { this.unsubs.forEach((f) => { try { f(); } catch { /* yok */ } }); this.unsubs = []; reminders.cancelAll(); }

  private async onAuth(u: FbUser | null) {
    if (!u) {
      this.stopListeners(); db.reset();
      this.s = { ...empty(), ready: true }; this.emit();
      const init = this.consumeInitial();
      if (init && PUBLIC_SCREENS.has(init.screen) && init.screen !== 'SYS-04') nav.resetTo(init.screen, init.params);
      else if (nav.mode !== 'auth' || !PUBLIC_SCREENS.has(nav.current().screen)) nav.resetTo(prefs.get().onboardingDone ? 'AUT-01' : 'ONB-01');
      return;
    }
    this.patch({ fbUser: u, uid: u.uid, email: u.email, emailVerified: u.emailVerified });
    if (!u.emailVerified) { this.patch({ ready: true }); this.consumeInitial(); nav.resetTo('AUT-03'); return; }
    await this.route(u, { first: true });
  }
  /** Doğrulanmış kullanıcı: belgeyi oku, duruma göre yönlendir. */
  async route(u: FbUser = auth.currentUser!, opts: { first?: boolean } = {}) {
    if (!u) return;
    const isSuper = await isSuperAdmin(u);
    let user: User | null = null;
    try { user = await getUser(u.uid); }
    catch (e) { console.warn('kullanıcı belgesi okunamadı', e); this.patch({ ready: true, isSuper }); nav.resetTo('SYS-02'); return; }
    if (user) userCache.put(user);
    this.patch({ isSuper, user, emailVerified: true });
    if (user?.status === 'suspended') {
      await signOut(); ui.openDialog('DLG-01', { reason: user.suspendReason }); return;
    }
    if (user?.status === 'deleted') {
      try { await resumeCleanup(u.uid); } catch (e) { console.warn(e); }
      await signOut(); return;
    }
    if (!user) {
      // AUT-05 öncesi profil belgesi (profileComplete:false) oluşturulur
      const name = (u.displayName || (u.email || '').split('@')[0].replace(/[._]/g, ' ')).trim() || 'Öğrenci';
      try {
        await createProfile({ uid: u.uid, email: u.email || '', name, nameLower: trLower(name), avatarSeed: u.uid });
        user = await getUser(u.uid); if (user) userCache.put(user);
        this.patch({ user });
      } catch (e) { console.warn('profil oluşturulamadı', e); this.patch({ ready: true }); nav.resetTo('SYS-02'); return; }
    }
    if (!user!.profileComplete) { this.patch({ ready: true }); this.consumeInitial(); nav.resetTo('AUT-05'); return; }
    await this.startSession(u.uid, u.email || '');
    this.patch({ ready: true });
    const init = this.consumeInitial();
    if (init && TAB_OF(init.screen) && !(init.screen === 'ADM-01' && !isSuper) && !(init.screen.startsWith('ADM') && !isSuper)) nav.resetTo(init.screen, init.params);
    else nav.enterApp('clubs');
    if (opts.first) maybeAskNotifications();
  }
  private consumeInitial() { const i = this.initial; this.initial = null as any; return i; }

  private async startSession(uid: string, email: string) {
    this.stopListeners();
    void touchLastLogin(uid).catch(() => ensureAccountDoc(uid, email).catch(() => undefined));
    this.unsubs.push(watchMyMemberships(uid, (list) => {
      const map: Record<string, Membership> = {}; list.forEach((m) => { map[m.clubId] = m; });
      this.patch({ memberships: map, membershipsLoaded: true, listenerError: false });
    }, () => this.patch({ listenerError: true, membershipsLoaded: true })));
    let firstInbox = true;
    this.unsubs.push(watchInbox(uid, (items) => {
      const prev = new Set(this.s.inbox.map((n) => n.id));
      const fresh = firstInbox ? [] : items.filter((n) => !prev.has(n.id) && !n.read);
      firstInbox = false;
      this.patch({ inbox: items, inboxLoaded: true });
      fresh.forEach((n) => systemNotify(n));
    }, () => this.patch({ inboxLoaded: true })));
    const [settings, blocked, saved] = await Promise.all([
      getSettings(uid).catch(() => DEFAULT_SETTINGS),
      fetchActiveBlocks(uid).catch(() => new Set<string>()),
      listAllSavedIds(uid).catch(() => new Set<string>()),
    ]);
    this.patch({ settings, blocked: [...blocked], savedIds: [...saved] });
    void this.reloadRsvps();
    void db.load('clubs', async () => db.putClubs(await fetchActiveClubs()), { force: true });
  }
  async reloadRsvps() {
    const uid = this.s.uid; if (!uid) return;
    try {
      const list = await listMyRsvps(uid); const map: Record<string, Rsvp> = {};
      list.forEach((r) => { map[r.eventId] = r; }); this.patch({ rsvps: map, rsvpsLoaded: true });
      reminders.sync();
    } catch (e) { console.warn('rsvp listesi', e); this.patch({ rsvpsLoaded: true }); }
  }
  async refreshUser() { const uid = this.s.uid; if (!uid) return; const u = await getUser(uid); if (u) { userCache.put(u); this.patch({ user: u }); } }
  setRsvp(eventId: string, r: Rsvp | null) { const map = { ...this.s.rsvps }; if (r) map[eventId] = r; else delete map[eventId]; this.patch({ rsvps: map }); reminders.sync(); }
  async logout() {
    this.stopListeners(); ui.reset(); forms.clear(); db.reset();
    try { await signOut(); } catch { /* yok */ }
    // onAuth(null) yönlendirir
  }
}
export const session = new Session();

/* ---------- tarayıcı bildirimleri (sekme arka plandayken) ---------- */
export const notifPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
function maybeAskNotifications() {
  const p = prefs.get();
  if (notifPermission() === 'default' && (!p.notifAskedAt || Date.now() - p.notifAskedAt > 3 * 864e5)) setTimeout(() => ui.openDialog('DLG-03'), 600);
}
let notifTextFn: ((n: AppNotification) => { title: string; body: string }) | null = null;
export const setNotifText = (fn: typeof notifTextFn) => { notifTextFn = fn; };
function systemNotify(n: AppNotification) {
  try {
    if (notifPermission() !== 'granted' || document.visibilityState === 'visible' || !notifTextFn) return;
    const { title, body } = notifTextFn(n);
    const note = new Notification(title, { body, icon: '/icons/icon-192.png', tag: n.id });
    note.onclick = () => { window.focus(); note.close(); };
  } catch { /* desteklenmiyor */ }
}
