/* Cihaz tercihleri (yerel): dil, tema, yazı boyutu, karşılama, son aramalar, bildirim izni. */
import { createStore, readLocal, writeLocal } from '../lib/store';

export type ThemePref = 'system' | 'light' | 'dark';
export interface Prefs {
  locale: 'tr' | 'en';
  theme: ThemePref;
  textScale: number;
  onboardingDone: boolean;
  recentSearches: string[];
  notifAskedAt: number | null;
  clubView: 'list' | 'grid';
}
const KEY = 'gu.prefs.v1';
const defaults: Prefs = {
  locale: (typeof navigator !== 'undefined' && navigator.language && !navigator.language.toLowerCase().startsWith('tr')) ? 'en' : 'tr',
  theme: 'system', textScale: 1, onboardingDone: false, recentSearches: [], notifAskedAt: null, clubView: 'list',
};
export const prefs = createStore<Prefs>({ ...defaults, ...readLocal<Partial<Prefs>>(KEY, {}) });
prefs.subscribe(() => writeLocal(KEY, prefs.get()));
export const setPrefs = (p: Partial<Prefs>) => prefs.patch(p);

const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
export const systemTheme = createStore<'light' | 'dark'>(mq && mq.matches ? 'dark' : 'light');
try { mq?.addEventListener('change', (e) => systemTheme.set(e.matches ? 'dark' : 'light')); } catch { /* eski tarayıcı */ }
export const resolvedTheme = () => { const p = prefs.get().theme; return p === 'system' ? systemTheme.get() : p; };

/** Çevrimiçi durumu (navigator.onLine + olaylar). */
export const network = createStore<{ online: boolean }>({ online: typeof navigator === 'undefined' ? true : navigator.onLine });
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => network.set({ online: true }));
  window.addEventListener('offline', () => network.set({ online: false }));
}
