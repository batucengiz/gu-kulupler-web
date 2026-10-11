/* ICU alt kümesi (plural/select/param) — tasarım prototipi core.js ile aynı motor. */
import { TR, EN } from './dict';
import { WEB_TR, WEB_EN } from './web';
import { prefs } from '../app/prefs';
import { trSuffix } from './tr-suffix';

const DICT: Record<'tr' | 'en', Record<string, string>> = { tr: { ...TR, ...WEB_TR }, en: { ...EN, ...WEB_EN } };
const missing = new Set<string>();

function matchBrace(str: string, i: number) { let d = 0; for (let j = i; j < str.length; j++) { if (str[j] === '{') d++; else if (str[j] === '}') { d--; if (d === 0) return j; } } return str.length - 1; }
function splitTop(s: string, max: number) { const out: string[] = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '{') d++; if (ch === '}') d--; if (ch === ',' && d === 0 && out.length < max - 1) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }
function parseBranches(s: string) { const b: Record<string, string> = {}; const re = /(=?\w+)\s*\{/g; let m: RegExpExecArray | null; while ((m = re.exec(s))) { const end = matchBrace(s, m.index + m[0].length - 1); b[m[1]] = s.slice(m.index + m[0].length, end); re.lastIndex = end + 1; } return b; }
export function fmtNum(n: number, loc: string) { try { return new Intl.NumberFormat(loc === 'tr' ? 'tr-TR' : 'en-GB').format(n); } catch { return String(n); } }
export type Params = Record<string, string | number | null | undefined>;
export function icu(str: string, params: Params, loc: string): string {
  let out = ''; let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (c === '{') {
      const end = matchBrace(str, i); const inner = str.slice(i + 1, end); i = end + 1;
      const parts = splitTop(inner, 3); const name = parts[0].trim();
      if (parts.length === 1) {
        const v = params[name]; out += v == null ? '' : v;
        // Türkçe: "{x}'ın" gibi kesme işaretli ek, değerin okunuşuna uydurulur.
        const m = loc === 'tr' && v != null && v !== '' ? /^['’]([a-zçğıöşü]+)/.exec(str.slice(i)) : null;
        if (m) { out += str[i] + trSuffix(String(v), m[1]); i += m[0].length; }
        continue;
      }
      const type = parts[1].trim();
      if (type === 'plural') {
        const n = Number(params[name] ?? 0); let cat = 'other';
        try { cat = new Intl.PluralRules(loc === 'tr' ? 'tr' : 'en').select(n); } catch { cat = n === 1 ? 'one' : 'other'; }
        const br = parseBranches(parts[2] || ''); const chosen = br['=' + n] ?? br[cat] ?? br.other ?? '';
        out += icu(chosen.replace(/#/g, fmtNum(n, loc)), params, loc);
      } else if (type === 'select') {
        const br = parseBranches(parts[2] || ''); const v = String(params[name]); out += icu(br[v] ?? br.other ?? '', params, loc);
      } else out += params[name] ?? '';
    } else { out += c; i++; }
  }
  return out;
}
export const locale = () => prefs.get().locale;
export function tIn(loc: 'tr' | 'en', key: string, params?: Params): string {
  const s = DICT[loc][key] ?? DICT.tr[key];
  if (s == null) { if (!missing.has(key)) { missing.add(key); if (import.meta.env.DEV) console.warn('[i18n] eksik anahtar', key); } return key; }
  return params ? icu(s, params, loc) : s;
}
export const t = (key: string, params?: Params) => tIn(locale(), key, params);
export const hasKey = (key: string) => key in DICT.tr;
