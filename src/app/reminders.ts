/* LocalReminderService (web): sekme açıkken etkinlik hatırlatması — süre gelince bildirim kutusuna kendi
   event_reminder belgesini yazar (CD-44) ve izin verilmişse tarayıcı bildirimi gösterir. */
import { db } from './data';
import { createSelfReminder } from '../data/repo/notifications';
import { getEvents } from '../data/repo/events';

const OFFSET: Record<string, number> = { '15m': 15 * 6e4, '1h': 36e5, '1d': 864e5 };
const timers = new Map<string, ReturnType<typeof setTimeout>>();
type Ctx = () => { uid: string | null; rsvps: Record<string, { eventId: string; clubId: string; status: string; reminder: string }>; enabled: boolean };
let ctx: Ctx | null = null;

export const reminders = {
  bind(fn: Ctx) { ctx = fn; },
  cancelAll() { timers.forEach((t) => clearTimeout(t)); timers.clear(); },
  async sync() {
    this.cancelAll();
    if (!ctx) return; const { uid, rsvps, enabled } = ctx(); if (!uid || !enabled) return;
    const active = Object.values(rsvps).filter((r) => (r.status === 'going' || r.status === 'waitlist') && r.reminder && r.reminder !== 'none');
    const missing = active.map((r) => r.eventId).filter((id) => !db.events[id]);
    if (missing.length) { try { db.putEvents(await getEvents(missing)); } catch { /* sonraki eşitlemede */ } }
    const now = Date.now();
    for (const r of active) {
      const e = db.events[r.eventId]; if (!e || e.status !== 'published') continue;
      const at = e.startsAt - (OFFSET[r.reminder] || 0);
      if (e.startsAt <= now) continue;
      const delay = Math.max(0, at - now);
      if (delay > 2 ** 31 - 1) continue; // setTimeout sınırı (~24 gün)
      timers.set(r.eventId, setTimeout(() => { void createSelfReminder(uid, r.eventId, r.clubId); }, delay));
    }
  },
};
