/* `app` cephesi — tasarım prototipindeki global `app` nesnesinin web karşılığı. Ekranlar yalnızca bunu kullanır. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { nav, ui, uiState, forms } from './core';
import { session } from './session';
import { db } from './data';
import { sel } from './sel';
import { prefs, setPrefs, resolvedTheme, network } from './prefs';
import { t, tIn, locale } from '../i18n';
import { fmt } from '../lib/fmt';
import { APP_NAME, APP_VERSION, ALLOWED_EMAIL_DOMAINS, LIMITS } from '../lib/constants';
import { AppError, errCode } from '../data/fs';

/** Hata kodu → kullanıcıya gösterilecek toast/dialog. Döndürülen true: işlendi. */
export function handleError(e: unknown): void {
  const code = errCode(e);
  const map: Record<string, () => void> = {
    offline: () => ui.showToast('TST-24'),
    network: () => ui.showToast('TST-X40', { text: t('web.err.network') }),
    unavailable: () => ui.showToast('TST-X40', { text: t('web.err.network') }),
    conflict: () => ui.openDialog('DLG-18'),
    aborted: () => ui.openDialog('DLG-18'),
    'failed-precondition': () => ui.showToast('TST-X40', { text: t('web.err.generic') }),
    'permission-denied': () => ui.showToast('TST-X18'),
    forbidden: () => ui.showToast('TST-X18'),
    notFound: () => ui.showToast('TST-X40', { text: t('sys.notFound.title') }),
    applicationsClosed: () => ui.showToast('TST-X1'),
    registrationClosed: () => ui.showToast('TST-X2'),
    eventEnded: () => ui.showToast('TST-X6'),
    eventCancelled: () => ui.showToast('TST-X6'),
    notRegistered: () => ui.showToast('TST-X7'),
    presidentCannotLeave: () => ui.showToast('TST-X10'),
    capacityFull: () => ui.showToast('TST-X14'),
    undoExpired: () => ui.showToast('TST-X40', { text: t('web.err.undoExpired') }),
    alreadyExists: () => ui.showToast('TST-X40', { text: t('web.err.alreadyVoted') }),
    attendanceWindowClosed: () => ui.showToast('TST-X40', { text: t('web.err.windowClosed') }),
    eventHasRegistrations: () => ui.showToast('TST-X40', { text: t('web.err.hasRegistrations') }),
    capacityBelowGoing: () => ui.showToast('TST-X40', { text: t('web.err.capacityBelow') }),
    nameTaken: () => ui.showToast('TST-X40', { text: t('web.err.nameTaken') }),
    announcementLimit: () => ui.openDialog('DLG-24'),
    invalidType: () => ui.showToast('TST-X40', { text: t('web.err.imageType') }),
    sizeLimit: () => ui.showToast('TST-X40', { text: t('web.err.imageSize') }),
    tooManyRequests: () => ui.showToast('TST-X40', { text: t('web.err.tooMany') }),
    'resource-exhausted': () => ui.showToast('TST-X40', { text: t('web.err.tooMany') }),
    requiresRecentLogin: () => ui.showToast('TST-X40', { text: t('web.err.recentLogin') }),
    retryCooldown: () => ui.showToast('TST-X40', { text: t('web.err.generic') }),
  };
  (map[code] || (() => ui.showToast('TST-X40', { text: t('web.err.generic') })))();
  if (!map[code]) console.error(e);
}

export const app = {
  APP_NAME, APP_VERSION, ALLOWED_EMAIL_DOMAINS, LIMITS,
  nav, ui, forms, sel, db, session,
  get state() { return { ui: uiState.state, session: { ...prefs.get(), userId: session.s.uid } }; },
  t, tIn, locale, fmt,
  theme: () => resolvedTheme(),
  textScale: () => prefs.get().textScale || 1,
  me: () => session.s.user,
  uid: () => session.s.uid,
  online: () => network.get().online,
  refresh: () => uiState.emit(),
  /** Yerel durum eylemleri (prototip dispatch'inin veri dışı kısmı). */
  dispatch(type: string, payload: any = {}) {
    switch (type) {
      case 'ui.set': uiState.set(payload); return;
      case 'session.set': setPrefs(payload); return;
      case 'search.add': { const q = String(payload.q || '').trim(); if (!q) return; setPrefs({ recentSearches: [q, ...prefs.get().recentSearches.filter((x) => x.toLocaleLowerCase('tr') !== q.toLocaleLowerCase('tr'))].slice(0, LIMITS.recentSearchesMax) }); return; }
      case 'search.remove': setPrefs({ recentSearches: prefs.get().recentSearches.filter((_, k) => k !== payload.i) }); return;
      case 'search.set': setPrefs({ recentSearches: payload.list || [] }); return;
      default: console.error('bilinmeyen eylem', type);
    }
  },
  openSheet: (id: string, props?: any) => ui.openSheet(id, props), closeSheet: (n?: number) => ui.closeSheet(n), replaceSheet: (id: string, p?: any) => ui.replaceSheet(id, p),
  openDialog: (id: string, props?: any) => ui.openDialog(id, props), closeDialog: () => ui.closeDialog(),
  openMenu: (id: string, props?: any) => ui.openMenu(id, props), closeMenu: () => ui.closeMenu(),
  toast: (id: string, props?: any) => ui.showToast(id, props), hideToast: () => ui.hideToast(),
  requireOnline() { if (!network.get().online) { ui.showToast('TST-24'); return false; } return true; },
  /** Kulüp bağlamında yazma koruması: danışman → salt okunur; çevrimdışı → uyarı. */
  guard(clubId?: string | null) {
    if (clubId && sel.isAdvisor(clubId, session.s.uid)) { ui.showToast('TST-26'); return false; }
    return app.requireOnline();
  },
  /** Ağ işlemi: çevrimdışıysa durdur, hatayı kullanıcıya göster, sonucu döndür (hata → undefined). */
  async run<T>(fn: () => Promise<T>, opts: { allowOffline?: boolean; onError?: (e: unknown) => boolean | void } = {}): Promise<T | undefined> {
    if (!opts.allowOffline && !network.get().online) { ui.showToast('TST-24'); return undefined; }
    try { return await fn(); }
    catch (e) { if (opts.onError && opts.onError(e) === true) return undefined; handleError(e); return undefined; }
  },
  error: (code: string) => new AppError(code),
  /** Ana sayfa: oturum varsa Kulüpler sekmesi, yoksa giriş/tanıtım. */
  home() {
    ui.reset();
    if (session.s.user && session.s.user.profileComplete && session.s.emailVerified) nav.enterApp('clubs');
    else nav.resetTo(prefs.get().onboardingDone ? 'AUT-01' : 'ONB-01');
  },
};
export type App = typeof app;

/* ---------- kancalar (prototip core.js ile aynı) ---------- */
export function useForm<T extends Record<string, any> = any>(key: string, init: T | (() => T)): [any, (patch: Partial<T> | Record<string, any> | ((cur: any) => any)) => void, () => void] {
  if (!forms.data[key]) forms.data[key] = typeof init === 'function' ? (init as () => T)() : { ...init };
  const f = forms.data[key] as T;
  const set = (patch: any) => { const cur = forms.data[key] || {}; const p = typeof patch === 'function' ? patch(cur) : patch; forms.data[key] = { ...cur, ...p }; forms.emit(); };
  const reset = () => { delete forms.data[key]; forms.emit(); };
  return [f, set, reset];
}
export function useBusy(): [boolean, <T>(fn: () => Promise<T>) => Promise<T | undefined>] {
  const [busy, setBusy] = useState(false); const ref = useRef(false); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []); // StrictMode: bağla-çöz-bağla
  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    if (ref.current) return undefined; ref.current = true; setBusy(true);
    try { return await fn(); } catch (e) { handleError(e); return undefined; } finally { ref.current = false; if (alive.current) setBusy(false); }
  }, []);
  return [busy, run];
}
export function useCountdown(until: number | null | undefined) {
  const [, tick] = useState(0);
  useEffect(() => { if (!until) return; const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, [until]);
  return Math.max(0, Math.ceil(((until || 0) - Date.now()) / 1000));
}
export function useFocusTrap(ref: React.RefObject<HTMLElement>, onClose: (() => void) | null, active = true) {
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (!active || !ref.current) return; const root = ref.current; const prev = document.activeElement as HTMLElement | null;
    const q = 'button:not([disabled]),[href],input:not([disabled]),textarea:not([disabled]),select,[tabindex]:not([tabindex="-1"])';
    const first = (root.querySelector('[data-autofocus]') || root.querySelector(q)) as HTMLElement | null;
    if (first) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch { /* yok */ } }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeRef.current) { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab') return; const items = [...root.querySelectorAll<HTMLElement>(q)].filter((el) => el.offsetParent !== null); if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); } else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    };
    root.addEventListener('keydown', onKey);
    return () => { root.removeEventListener('keydown', onKey); if (prev && prev.focus) { try { prev.focus({ preventScroll: true }); } catch { /* yok */ } } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
export function useTicker(ms: number) { const [, s] = useState(0); useEffect(() => { const id = setInterval(() => s((x) => x + 1), ms); return () => clearInterval(id); }, [ms]); }
export { db };
