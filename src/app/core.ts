/* Uygulama çekirdeği: arayüz durumu, katmanlar (sheet/dialog/menü/toast/görüntüleyici), form taslakları, gezinme.
   Tasarım prototipi core.js ile aynı API; gezinme gerçek URL'lerle (History API) eşlenir. */
import { LIMITS, TABS, type Tab } from '../lib/constants';

/* ---------- küçük yayıncı ---------- */
export class Emitter {
  private ls = new Set<() => void>();
  subscribe = (fn: () => void) => { this.ls.add(fn); return () => { this.ls.delete(fn); }; };
  emit() { this.ls.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
}
let seq = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(++seq).toString(36)}`;

/* ---------- arayüz durumu (app.state.ui) — süzgeçler, görünüm modu vb. ---------- */
export const uiState = new (class extends Emitter {
  state: Record<string, any> = {};
  set(patch: Record<string, any>) { this.state = { ...this.state, ...patch }; this.emit(); }
})();

/* ---------- katmanlar ---------- */
export interface Layer { id: string; props: any; key: string }
export interface ToastState { id: string; props: any; key: string }
export const ui = new (class extends Emitter {
  sheets: Layer[] = []; dialogs: Layer[] = []; toast: ToastState | null = null; menu: Layer | null = null; viewer: any = null;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  notify() { this.emit(); }
  openSheet(id: string, props: any = {}) { this.sheets = [...this.sheets, { id, props, key: uid('s') }]; this.emit(); }
  closeSheet(n = 1) { this.sheets = this.sheets.slice(0, Math.max(0, this.sheets.length - n)); this.emit(); }
  closeAllSheets() { this.sheets = []; this.emit(); }
  replaceSheet(id: string, props: any = {}) { this.sheets = [...this.sheets.slice(0, -1), { id, props, key: uid('s') }]; this.emit(); }
  removeSheet(l: Layer) { this.sheets = this.sheets.filter((s) => s !== l); this.emit(); }
  openDialog(id: string, props: any = {}) { this.dialogs = [...this.dialogs, { id, props, key: uid('d') }]; this.emit(); }
  closeDialog() { this.dialogs = this.dialogs.slice(0, -1); this.emit(); }
  removeDialog(l: Layer) { this.dialogs = this.dialogs.filter((d) => d !== l); this.emit(); }
  closeAllDialogs() { this.dialogs = []; this.emit(); }
  openMenu(id: string, props: any = {}) { this.menu = { id, props, key: uid('m') }; this.emit(); }
  closeMenu() { this.menu = null; this.emit(); }
  openViewer(props: any) { this.viewer = props; this.emit(); }
  closeViewer() { this.viewer = null; this.emit(); }
  showToast(id: string, props: any = {}) {
    clearTimeout(this.toastTimer); this.toast = { id, props, key: uid('t') }; this.emit();
    const ms = props.duration || (props.undo || props.action ? LIMITS.undoToastMs : LIMITS.toastMs);
    this.toastTimer = setTimeout(() => { this.toast = null; this.emit(); }, ms);
  }
  hideToast() { clearTimeout(this.toastTimer); this.toast = null; this.emit(); }
  closeTop() {
    if (this.viewer) { this.closeViewer(); return true; }
    if (this.menu) { this.closeMenu(); return true; }
    if (this.dialogs.length) { this.closeDialog(); return true; }
    if (this.sheets.length) { this.closeSheet(); return true; }
    return false;
  }
  reset() { this.sheets = []; this.dialogs = []; this.menu = null; this.viewer = null; this.emit(); }
})();

/* ---------- form taslakları (gezinmede korunur) ---------- */
export const forms = new (class extends Emitter {
  data: Record<string, any> = {};
  clear() { this.data = {}; }
})();

/* ---------- gezinme ---------- */
export interface Route { screen: string; params: Record<string, any>; key: string }
export const TAB_ROOT: Record<Tab, string> = { clubs: 'CLB-01', events: 'EVT-01', notifications: 'NTF-01', admin: 'ADM-01', profile: 'PRF-01' };
export const TAB_OF = (screen: string): Tab | null =>
  (({ CLB: 'clubs', FED: 'clubs', MGT: 'clubs', EVT: 'events', NTF: 'notifications', PRF: 'profile', SET: 'profile', ADM: 'admin' } as Record<string, Tab>)[screen.slice(0, 3)] || null);
const enc = encodeURIComponent;
export const ROUTE_PATH: Record<string, (p: any) => string> = {
  'SYS-01': () => '/splash', 'SYS-02': () => '/error', 'SYS-03': () => '/offline', 'SYS-04': () => '/not-found', 'ONB-01': () => '/onboarding',
  'AUT-01': () => '/login', 'AUT-02': () => '/register', 'AUT-03': () => '/verify', 'AUT-04': () => '/reset', 'AUT-05': () => '/setup-profile', 'AUT-06': (p) => `/legal/${p.tab || 'kvkk'}`,
  'CLB-01': () => '/clubs', 'CLB-02': () => '/clubs/search', 'CLB-03': (p) => `/clubs/${enc(p.id)}`, 'CLB-04': (p) => `/clubs/${enc(p.id)}/applied`, 'CLB-05': (p) => `/clubs/${enc(p.id)}/application`, 'CLB-06': (p) => `/clubs/${enc(p.id)}/members`, 'CLB-07': (p) => `/users/${enc(p.id)}`,
  'FED-01': (p) => `/clubs/${enc(p.id)}/feed`, 'FED-02': (p) => `/clubs/${enc(p.clubId)}/posts/${enc(p.postId)}`, 'FED-03': (p) => `/clubs/${enc(p.clubId)}/compose${p.edit ? '?edit=' + enc(p.edit) : ''}`,
  'EVT-01': () => '/events', 'EVT-02': (p) => `/events/${enc(p.id)}`, 'EVT-03': (p) => `/events/${enc(p.id)}/ticket`, 'EVT-04': () => '/events/mine',
  'NTF-01': () => '/notifications', 'NTF-02': () => '/settings/notifications',
  'PRF-01': () => '/profile', 'PRF-02': () => '/profile/edit', 'PRF-03': () => '/profile/clubs', 'PRF-04': () => '/profile/saved',
  'SET-01': () => '/settings', 'SET-02': () => '/settings/blocked', 'SET-03': () => '/settings/delete', 'SET-04': () => '/settings/about', 'SET-05': () => '/settings/support',
  'MGT-01': (p) => `/manage/${enc(p.clubId)}`, 'MGT-02': (p) => `/manage/${enc(p.clubId)}/applications`, 'MGT-03': (p) => `/manage/${enc(p.clubId)}/members`, 'MGT-04': (p) => `/manage/${enc(p.clubId)}/events`,
  'MGT-05': (p) => `/manage/${enc(p.clubId)}/events/${p.eventId ? enc(p.eventId) + '/edit' : 'new'}`,
  'MGT-06': (p) => `/manage/${enc(p.clubId)}/events/${enc(p.eventId)}/attendance`, 'MGT-07': (p) => `/manage/${enc(p.clubId)}/events/${enc(p.eventId)}/scan`, 'MGT-08': (p) => `/manage/${enc(p.clubId)}/content`,
  'MGT-09': (p) => `/manage/${enc(p.clubId)}/settings`, 'MGT-10': (p) => `/manage/${enc(p.clubId)}/activity`,
  'ADM-01': () => '/admin', 'ADM-02': () => '/admin/clubs', 'ADM-03': (p) => `/admin/clubs/${p.id ? enc(p.id) + '/edit' : 'new'}`, 'ADM-04': () => '/admin/reports', 'ADM-05': () => '/admin/users',
};
/** URL → ekran. Sıra önemlidir (özel yollar genelden önce). */
const PATTERNS: Array<[RegExp, string, (m: RegExpExecArray, q: URLSearchParams) => Record<string, any>]> = [
  [/^\/$/, 'CLB-01', () => ({})],
  [/^\/onboarding$/, 'ONB-01', () => ({})], [/^\/login$/, 'AUT-01', () => ({})], [/^\/register$/, 'AUT-02', () => ({})], [/^\/verify$/, 'AUT-03', () => ({})],
  [/^\/reset$/, 'AUT-04', () => ({})], [/^\/setup-profile$/, 'AUT-05', () => ({})], [/^\/legal\/([\w-]+)$/, 'AUT-06', (m) => ({ tab: m[1] })],
  [/^\/not-found$/, 'SYS-04', () => ({})], [/^\/error$/, 'SYS-02', () => ({})], [/^\/offline$/, 'SYS-03', () => ({})],
  [/^\/clubs$/, 'CLB-01', () => ({})], [/^\/clubs\/search$/, 'CLB-02', (_m, q) => ({ tab: q.get('tab') || 'clubs' })],
  [/^\/clubs\/([^/]+)\/applied$/, 'CLB-04', (m) => ({ id: m[1] })], [/^\/clubs\/([^/]+)\/application$/, 'CLB-05', (m) => ({ id: m[1] })],
  [/^\/clubs\/([^/]+)\/members$/, 'CLB-06', (m) => ({ id: m[1] })], [/^\/clubs\/([^/]+)\/feed$/, 'CLB-03', (m) => ({ id: m[1], tab: 'feed' })],
  [/^\/clubs\/([^/]+)\/posts\/([^/]+)$/, 'FED-02', (m) => ({ clubId: m[1], postId: m[2] })], [/^\/clubs\/([^/]+)\/compose$/, 'FED-03', (m, q) => ({ clubId: m[1], edit: q.get('edit') || undefined })],
  [/^\/clubs\/([^/]+)$/, 'CLB-03', (m) => ({ id: m[1] })], [/^\/users\/([^/]+)$/, 'CLB-07', (m) => ({ id: m[1] })],
  [/^\/events$/, 'EVT-01', () => ({})], [/^\/events\/mine$/, 'EVT-04', () => ({})], [/^\/events\/([^/]+)\/ticket$/, 'EVT-03', (m) => ({ id: m[1] })], [/^\/events\/([^/]+)$/, 'EVT-02', (m) => ({ id: m[1] })],
  [/^\/notifications$/, 'NTF-01', () => ({})], [/^\/settings\/notifications$/, 'NTF-02', () => ({})],
  [/^\/profile$/, 'PRF-01', () => ({})], [/^\/profile\/edit$/, 'PRF-02', () => ({})], [/^\/profile\/clubs$/, 'PRF-03', () => ({})], [/^\/profile\/saved$/, 'PRF-04', () => ({})],
  [/^\/settings$/, 'SET-01', () => ({})], [/^\/settings\/blocked$/, 'SET-02', () => ({})], [/^\/settings\/delete$/, 'SET-03', () => ({})], [/^\/settings\/about$/, 'SET-04', () => ({})], [/^\/settings\/support$/, 'SET-05', () => ({})],
  [/^\/manage\/([^/]+)$/, 'MGT-01', (m) => ({ clubId: m[1] })], [/^\/manage\/([^/]+)\/applications$/, 'MGT-02', (m) => ({ clubId: m[1] })], [/^\/manage\/([^/]+)\/members$/, 'MGT-03', (m) => ({ clubId: m[1] })],
  [/^\/manage\/([^/]+)\/events$/, 'MGT-04', (m) => ({ clubId: m[1] })], [/^\/manage\/([^/]+)\/events\/new$/, 'MGT-05', (m) => ({ clubId: m[1] })],
  [/^\/manage\/([^/]+)\/events\/([^/]+)\/edit$/, 'MGT-05', (m) => ({ clubId: m[1], eventId: m[2] })], [/^\/manage\/([^/]+)\/events\/([^/]+)\/attendance$/, 'MGT-06', (m) => ({ clubId: m[1], eventId: m[2] })],
  [/^\/manage\/([^/]+)\/events\/([^/]+)\/scan$/, 'MGT-07', (m) => ({ clubId: m[1], eventId: m[2] })], [/^\/manage\/([^/]+)\/content$/, 'MGT-08', (m) => ({ clubId: m[1] })],
  [/^\/manage\/([^/]+)\/settings$/, 'MGT-09', (m) => ({ clubId: m[1] })], [/^\/manage\/([^/]+)\/activity$/, 'MGT-10', (m) => ({ clubId: m[1] })],
  [/^\/admin$/, 'ADM-01', () => ({})], [/^\/admin\/clubs$/, 'ADM-02', () => ({})], [/^\/admin\/clubs\/new$/, 'ADM-03', () => ({})], [/^\/admin\/clubs\/([^/]+)\/edit$/, 'ADM-03', (m) => ({ id: m[1] })],
  [/^\/admin\/reports$/, 'ADM-04', () => ({})], [/^\/admin\/users$/, 'ADM-05', () => ({})],
];
export function parsePath(pathname: string, search = ''): { screen: string; params: Record<string, any> } {
  const path = pathname.replace(/\/+$/, '') || '/'; const q = new URLSearchParams(search);
  for (const [re, screen, fn] of PATTERNS) {
    const m = re.exec(path);
    if (m) { const params = fn(m, q); for (const k in params) if (typeof params[k] === 'string') params[k] = decodeURIComponent(params[k]); return { screen, params }; }
  }
  return { screen: 'SYS-04', params: {} };
}
export const routePath = (r: { screen: string; params?: any }) => { const f = ROUTE_PATH[r.screen]; return f ? f(r.params || {}) : '/'; };
const mkRoute = (screen: string, params: Record<string, any> = {}): Route => ({ screen, params, key: uid('r') });
export const PUBLIC_SCREENS = new Set(['ONB-01', 'AUT-01', 'AUT-02', 'AUT-04', 'AUT-06', 'SYS-02', 'SYS-03', 'SYS-04']);

export const nav = new (class extends Emitter {
  mode: 'splash' | 'auth' | 'app' = 'splash';
  rootStack: Route[] = [mkRoute('SYS-01')];
  activeTab: Tab = 'clubs';
  stacks: Record<Tab, Route[]> = Object.fromEntries(TABS.map((tb) => [tb, [mkRoute(TAB_ROOT[tb])]])) as Record<Tab, Route[]>;
  scroll: Record<string, number> = {};
  anim: 'fade' | 'push' | 'pop' = 'fade';
  scrollTopReq = 0;
  /** Bu oturumda tarayıcı geçmişine eklediğimiz kayıt sayısı (etkin yığın için). */
  private pushed = 0;
  stack() { return this.mode === 'app' ? this.stacks[this.activeTab] : this.rootStack; }
  current() { const s = this.stack(); return s[s.length - 1]; }
  depth() { return this.stack().length; }
  private url(r: Route) { return routePath(r); }
  private write(kind: 'push' | 'replace') {
    try {
      const p = this.url(this.current()); const st = { gu: true };
      if (kind === 'push') history.pushState(st, '', p); else if (location.pathname + location.search !== p) history.replaceState(st, '', p);
    } catch { /* geçmiş API yok */ }
    if (typeof document !== 'undefined') document.title = pageTitle(this.current().screen);
  }
  push(screen: string, params: Record<string, any> = {}) {
    this.stack().push(mkRoute(screen, params)); this.anim = 'push'; this.pushed++; this.write('push'); this.emit();
  }
  replace(screen: string, params: Record<string, any> = {}) { const st = this.stack(); st[st.length - 1] = mkRoute(screen, params); this.anim = 'fade'; this.write('replace'); this.emit(); }
  /** Uygulama içi geri. Tarayıcı geçmişinde bizim kaydımız varsa history.back() (popstate yığını düşürür). */
  back(): boolean {
    const st = this.stack();
    if (st.length > 1) {
      if (this.pushed > 0) { this.pushed--; this.ignorePop = true; try { history.back(); } catch { /* yok */ } }
      st.pop(); this.anim = 'pop'; if (this.pushed === 0) this.write('replace'); else if (typeof document !== 'undefined') document.title = pageTitle(this.current().screen);
      this.emit(); return true;
    }
    if (this.mode === 'auth' && st[0].screen !== 'AUT-01' && st[0].screen !== 'ONB-01') { this.rootStack = [mkRoute('AUT-01')]; this.anim = 'pop'; this.write('replace'); this.emit(); return true; }
    return false;
  }
  ignorePop = false;
  onPopState() {
    if (this.ignorePop) { this.ignorePop = false; return; }
    const st = this.stack();
    // yalnızca adres bir önceki ekranınkiyse "geri"dir; aksi halde (ileri tuşu, elle değişen adres) URL'den kurulur
    if (this.pushed > 0 && st.length > 1 && location.pathname + location.search === routePath(st[st.length - 2])) {
      this.pushed--; st.pop(); this.anim = 'pop'; this.emit(); return;
    }
    // yığının altına inildi ya da ileri gidildi: URL'den yeniden kur
    const r = parsePath(location.pathname, location.search);
    onExternalRoute?.(r.screen, r.params);
  }
  popTo(screen: string) { const st = this.stack(); const idx = st.map((r) => r.screen).lastIndexOf(screen); if (idx >= 0) { st.splice(idx + 1); this.anim = 'pop'; this.pushed = 0; this.write('replace'); this.emit(); return true; } return false; }
  switchTab(tab: Tab) {
    if (tab === this.activeTab) { const st = this.stacks[tab]; if (st.length > 1) { this.stacks[tab] = [st[0]]; this.anim = 'pop'; } else this.scrollTopReq++; }
    else { this.activeTab = tab; this.anim = 'fade'; }
    this.pushed = 0; this.write('replace'); this.emit();
  }
  resetStacks() { TABS.forEach((tb) => { this.stacks[tb] = [mkRoute(TAB_ROOT[tb])]; }); this.scroll = {}; }
  enterApp(tab: Tab = 'clubs') { this.mode = 'app'; this.resetStacks(); this.activeTab = tab; this.anim = 'fade'; this.pushed = 0; this.write('replace'); this.emit(); }
  resetTo(screen: string, params: Record<string, any> = {}) {
    const tab = TAB_OF(screen);
    if (tab) { this.mode = 'app'; this.resetStacks(); this.activeTab = tab; if (screen !== TAB_ROOT[tab]) this.stacks[tab].push(mkRoute(screen, params)); }
    else { this.mode = 'auth'; this.rootStack = [mkRoute(screen, params)]; }
    this.anim = 'fade'; this.pushed = 0; this.write('replace'); this.emit();
  }
  openInTab(tab: Tab, routes: Array<{ screen: string; params?: any }>) {
    this.mode = 'app'; this.activeTab = tab; this.stacks[tab] = [mkRoute(TAB_ROOT[tab]), ...routes.map((r) => mkRoute(r.screen, r.params || {}))];
    this.anim = 'push'; this.pushed = 0; this.write('replace'); this.emit();
  }
})();
let onExternalRoute: ((screen: string, params: any) => void) | null = null;
export const setExternalRouteHandler = (fn: (screen: string, params: any) => void) => { onExternalRoute = fn; };
if (typeof window !== 'undefined') window.addEventListener('popstate', () => nav.onPopState());

let titleFn: (screen: string) => string = () => 'GÜ Kulüpler';
export const setTitleFn = (fn: (screen: string) => string) => { titleFn = fn; };
const pageTitle = (screen: string) => titleFn(screen);
