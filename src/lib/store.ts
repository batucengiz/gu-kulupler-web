import { useSyncExternalStore } from 'react';

/** Küçük harici store: get/set/subscribe + React hook. */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: T | ((s: T) => T)) {
      state = typeof next === 'function' ? (next as (s: T) => T)(state) : next;
      listeners.forEach((l) => { try { l(); } catch (e) { console.error(e); } });
    },
    patch(p: Partial<T>) { this.set({ ...state, ...p }); },
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    use(): T { return useSyncExternalStore(this.subscribe, this.get, this.get); },
  };
}
export type Store<T> = ReturnType<typeof createStore<T>>;

export function readLocal<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw == null ? fallback : (JSON.parse(raw) as T); } catch { return fallback; }
}
export function writeLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* depolama yok: yalnızca bellek */ }
}
