/* Ortak yardımcılar — tasarım prototipi core.js ile aynı davranış. */
export const cx = (...a: unknown[]): string => a.filter(Boolean).join(' ');
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const pad2 = (n: number) => String(n).padStart(2, '0');

export function hashStr(s: unknown): number {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rngFor = (seed: string) => mulberry32(hashStr(seed));

export const initials = (name?: string | null) => {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0][0].toLocaleUpperCase('tr');
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr');
};
/** Türkçe küçük harf (CD-11): İ→i, I→ı. */
export const trLower = (s: string) => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr');
export const escapeHtml = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } catch { /* yoksay */ }
  fallbackCopy(text);
  return Promise.resolve();
}
function fallbackCopy(text: string) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  } catch { /* yoksay */ }
}
export function downloadText(text: string, name: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
}

/* ---------- tarih ---------- */
export const DAY = 864e5;
export const startOfDay = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const today0 = () => startOfDay(Date.now());
export const dayKey = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
export const isSameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);
export const dayDiff = (ts: number) => Math.round((startOfDay(ts) - today0()) / DAY);
/** Europe/Istanbul günü (UTC+3, DST yok) — duyuru sayacı belge kimliği. */
export function istanbulDay(tsUtc: number) {
  const d = new Date(tsUtc + 3 * 36e5);
  const y = d.getUTCFullYear(), m = pad2(d.getUTCMonth() + 1), dd = pad2(d.getUTCDate());
  return { key: `${y}${m}${dd}`, iso: `${y}-${m}-${dd}` };
}
/** Istanbul gününün başlangıcı (UTC ms). */
export function istanbulStartOfDay(tsUtc: number) {
  const d = new Date(tsUtc + 3 * 36e5); d.setUTCHours(0, 0, 0, 0); return d.getTime() - 3 * 36e5;
}

/* ---------- kimlik / kod üretimi (CSPRNG) ---------- */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomChars(n: number) {
  const out: string[] = []; const buf = new Uint32Array(n); crypto.getRandomValues(buf);
  for (let i = 0; i < n; i++) out.push(CODE_ALPHABET[buf[i] % CODE_ALPHABET.length]);
  return out.join('');
}
export const ticketCode = () => `GU-${randomChars(4)}-${randomChars(4)}`;
export const supportTicketNo = () => `GU-${randomChars(6)}`;
export const randomHex = (bytes = 8) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
/** StoragePaths.newFileName — `<yyyyMMddTHHmmssZ>_<16hex>.<ext>` */
export function newFileName(ext: 'jpg' | 'png' | 'webp') {
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
  return `${stamp}_${randomHex(8)}.${ext}`;
}
export const ticketQrPayload = (eventId: string, code: string) => `gu:ticket:v1:${eventId}:${code}`;
export function parseTicketQr(payload: string): { eventId: string; code: string } | null {
  const m = /^gu:ticket:v1:([^:]+):(GU-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4})$/.exec((payload || '').trim());
  return m ? { eventId: m[1], code: m[2] } : null;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const uniq = <T,>(a: T[]) => [...new Set(a)];
export function chunk<T>(arr: T[], n: number): T[][] { const out: T[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
export const at = (dayOff: number, hh = 0, mm = 0) => today0() + dayOff * DAY + hh * 36e5 + mm * 6e4;
export const slug = (s: string) => String(s).toLowerCase().replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
