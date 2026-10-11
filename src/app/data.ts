/* İstemci tarafı veri aynası: Firestore'dan okunan belgeler burada tutulur, seçiciler (sel) buradan eşzamanlı okur.
   Her okuma bir "yükleyici" anahtarıyla izlenir (yükleniyor / hata / tamam) — ListState bu durumları gösterir. */
import { useEffect } from 'react';
import { Emitter } from './core';
import type { Club, ClubEvent, Post, Membership, Rsvp, Comment, Activity } from '../data/models';

export type LoadStatus = 'idle' | 'loading' | 'ok' | 'error';
interface LoadEntry { status: LoadStatus; at: number; error?: unknown; promise?: Promise<unknown> }

class DataMirror extends Emitter {
  clubs: Record<string, Club> = {};
  events: Record<string, ClubEvent> = {};
  posts: Record<string, Post> = {};
  comments: Record<string, Comment[]> = {};
  /** Başkalarının üyelik belgeleri (üye listeleri, başvurular) — kimlik `${clubId}_${userId}` */
  memberships: Record<string, Membership> = {};
  /** Katılımcı listeleri (yönetici) — kimlik `${eventId}_${userId}` */
  rsvps: Record<string, Rsvp> = {};
  feeds: Record<string, { ids: string[]; cursor: any; hasMore: boolean }> = {};
  activity: Record<string, Activity[]> = {};
  /** Serbest biçimli türetilmiş değerler (sayılar, sıralar, grafik verisi) */
  extra: Record<string, any> = {};
  private loads = new Map<string, LoadEntry>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Değişiklikleri tek karede birleştirerek yayınla. */
  changed() { if (this.timer) return; this.timer = setTimeout(() => { this.timer = null; this.emit(); }, 0); }
  putClubs(list: Club[]) { list.forEach((c) => { this.clubs[c.id] = c; }); this.changed(); }
  putEvents(list: ClubEvent[]) { list.forEach((e) => { this.events[e.id] = e; }); this.changed(); }
  putPosts(list: Post[]) { list.forEach((p) => { this.posts[p.id] = p; }); this.changed(); }
  putMemberships(list: Membership[]) { list.forEach((m) => { this.memberships[m.id] = m; }); this.changed(); }
  putRsvps(list: Rsvp[]) { list.forEach((r) => { this.rsvps[r.id] = r; }); this.changed(); }
  patchClub(id: string, patch: Partial<Club>) { if (this.clubs[id]) { this.clubs[id] = { ...this.clubs[id], ...patch }; this.changed(); } }
  patchEvent(id: string, patch: Partial<ClubEvent>) { if (this.events[id]) { this.events[id] = { ...this.events[id], ...patch }; this.changed(); } }
  patchPost(id: string, patch: Partial<Post>) { if (this.posts[id]) { this.posts[id] = { ...this.posts[id], ...patch }; this.changed(); } }
  setExtra(k: string, v: any) { this.extra[k] = v; this.changed(); }

  status(key: string): LoadStatus { return this.loads.get(key)?.status || 'idle'; }
  error(key: string) { return this.loads.get(key)?.error; }
  /** Yükleyiciyi çalıştır; aynı anahtar uçuştaysa aynı söz döner. maxAge içinde tamamlanmışsa yeniden çalışmaz. */
  load<T>(key: string, fn: () => Promise<T>, opts: { force?: boolean; maxAge?: number } = {}): Promise<T | undefined> {
    const cur = this.loads.get(key);
    if (cur?.status === 'loading' && cur.promise) return cur.promise as Promise<T>;
    if (!opts.force && cur?.status === 'ok' && Date.now() - cur.at < (opts.maxAge ?? 60_000)) return Promise.resolve(undefined);
    const p = fn().then((v) => { this.loads.set(key, { status: 'ok', at: Date.now() }); this.changed(); return v; },
      (e) => { console.warn('[yükleme]', key, e); this.loads.set(key, { status: 'error', at: Date.now(), error: e }); this.changed(); return undefined; });
    // önceki veri varken arka planda yenileme: durum 'ok' kalır (titreme yok)
    this.loads.set(key, { status: cur?.status === 'ok' ? 'ok' : 'loading', at: cur?.at || 0, promise: p });
    if (cur?.status !== 'ok') this.changed();
    return p;
  }
  invalidate(prefix: string) { [...this.loads.keys()].forEach((k) => { if (k === prefix || k.startsWith(prefix + ':')) { const e = this.loads.get(k)!; this.loads.set(k, { ...e, at: 0 }); } }); }
  reset() {
    this.clubs = {}; this.events = {}; this.posts = {}; this.comments = {}; this.memberships = {}; this.rsvps = {}; this.feeds = {}; this.activity = {}; this.extra = {};
    this.loads.clear(); this.emit();
  }
}
export const db = new DataMirror();

/** Bileşen bağlandığında (ve anahtar değişince) yükle. Dönen durum: ListState için. */
export function useLoad(key: string | null, fn: () => Promise<unknown>, opts: { maxAge?: number } = {}) {
  useEffect(() => { if (key) void db.load(key, fn, opts); /* eslint-disable-next-line */ }, [key]);
  const status: LoadStatus = key ? db.status(key) : 'ok';
  return { status, reload: () => (key ? db.load(key, fn, { force: true }) : Promise.resolve(undefined)) };
}
