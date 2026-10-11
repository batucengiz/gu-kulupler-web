/* Türkçe kesme işaretli ekler: "{user}'ın", "{date}'den" kalıplarında ek, değerin okunuşuna göre (ünlü uyumu + ünsüz benzeşmesi) seçilir. */
const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
const VOWELS = 'aıoueiöüAIOUEİÖÜâîû';
const HARD = 'fstkçşhpFSTKÇŞHP';

/** Değerin sesletimdeki son sözcüğü (sayılar okunuşa çevrilir). */
function spoken(value: string): string {
  const w = value.trim().split(/\s+/).pop() || '';
  const m = /(\d+)$/.exec(w);
  if (!m) return w;
  const n = Number(m[1]);
  if (n === 0) return 'sıfır';
  if (n % 10) return ONES[n % 10];
  if (n % 100) return TENS[(n % 100) / 10];
  if (n % 1000) return 'yüz';
  if (n % 1e6) return 'bin';
  return 'milyon';
}

function lastVowel(w: string): string {
  for (let i = w.length - 1; i >= 0; i--) if (VOWELS.includes(w[i])) return w[i].toLocaleLowerCase('tr').replace('â', 'a').replace('î', 'i').replace('û', 'u');
  return 'e'; // ünlüsüz kısaltmalar (ör. "GDG") çoğunlukla "-e" ile okunur
}

/** Dört yönlü (ı/i/u/ü) ve iki yönlü (a/e) ünlü seçimi. */
const four = (v: string) => ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' } as Record<string, string>)[v] || 'i';
const two = (v: string) => ('aıou'.includes(v) ? 'a' : 'e');

/** Kalıptaki ek (ör. "ın", "den", "a", "ı") yerine değere uygun biçimi döndürür; tanınmayan ek olduğu gibi kalır. */
export function trSuffix(value: string, suffix: string): string {
  const w = spoken(value);
  if (!w) return suffix;
  const v = lastVowel(w);
  const last = w[w.length - 1];
  const endsVowel = VOWELS.includes(last);
  const hard = HARD.includes(last);
  const s = suffix.toLocaleLowerCase('tr');
  if (/^n?[ıiuü]n$/.test(s)) return (endsVowel ? 'n' : '') + four(v) + 'n'; // tamlayan: 'ın/'in/'nın
  if (/^[dt][ae]n$/.test(s)) return (hard ? 't' : 'd') + two(v) + 'n'; // ayrılma: 'den/'tan
  if (/^[dt][ae]$/.test(s)) return (hard ? 't' : 'd') + two(v); // bulunma: 'de/'ta
  if (/^y?[ae]$/.test(s)) return (endsVowel ? 'y' : '') + two(v); // yönelme: 'e/'ya
  if (/^y?[ıiuü]$/.test(s)) return (endsVowel ? 'y' : '') + four(v); // belirtme: 'i/'yı
  return suffix;
}
