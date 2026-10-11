import { t, locale, fmtNum } from '../i18n';
import { DAY, dayDiff, isSameDay } from './util';

const intlLoc = () => (locale() === 'tr' ? 'tr-TR' : 'en-GB');
function date(ts: number, opts?: Intl.DateTimeFormatOptions) {
  try { return new Intl.DateTimeFormat(intlLoc(), opts || { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ts)); } catch { return new Date(ts).toLocaleDateString(); }
}
export const fmt = {
  num: (n: number) => fmtNum(n, locale()),
  date,
  time: (ts: number) => date(ts, { hour: '2-digit', minute: '2-digit' }),
  dateShort: (ts: number) => date(ts, { day: 'numeric', month: 'short' }),
  dateLong: (ts: number) => date(ts, { weekday: 'long', day: 'numeric', month: 'long' }),
  dateTime: (ts: number) => `${date(ts, { weekday: 'short', day: 'numeric', month: 'short' })}, ${fmt.time(ts)}`,
  monthYear: (ts: number) => date(ts, { month: 'long', year: 'numeric' }),
  monthShort: (ts: number) => date(ts, { month: 'short' }).replace('.', ''),
  weekdayShort: (ts: number) => date(ts, { weekday: 'short' }),
  range(a: number, b?: number | null) { if (!b) return fmt.time(a); if (isSameDay(a, b)) return `${fmt.time(a)}–${fmt.time(b)}`; return `${fmt.dateTime(a)} → ${fmt.dateTime(b)}`; },
  duration(a: number, b?: number | null) { if (!b) return ''; const m = Math.round((b - a) / 6e4); if (m < 60) return t('time.minutes', { count: m }); const hrs = Math.round((m / 60) * 10) / 10; return t('time.hours', { count: hrs }); },
  rel(ts: number) {
    const diff = Date.now() - ts; const m = Math.round(diff / 6e4);
    if (m < 1) return t('time.justNow'); if (m < 60) return t('time.minutesAgo', { count: m });
    const hh = Math.round(m / 60); if (hh < 24) return t('time.hoursAgo', { count: hh });
    const d = Math.round(hh / 24); if (d === 1) return t('time.yesterday'); if (d < 7) return t('time.daysAgo', { count: d });
    if (d < 30) return t('time.weeksAgo', { count: Math.round(d / 7) }); return fmt.dateShort(ts);
  },
  dayLabel(ts: number) { const d = dayDiff(ts); if (d === 0) return t('time.today'); if (d === 1) return t('time.tomorrow'); if (d === -1) return t('time.yesterday'); return date(ts, { weekday: 'long', day: 'numeric', month: 'long' }); },
  countdown(ts: number) { const d = Math.max(0, Math.ceil((ts - Date.now()) / DAY)); return t('time.inDays', { count: d }); },
  pct: (n: number) => `%${Math.round(n)}`,
};
