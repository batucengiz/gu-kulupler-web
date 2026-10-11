// Tasarım prototipindeki TR/EN sözlüğünü (design/prototype/app/i18n-dict*.js) src/i18n/dict.ts dosyasına dönüştürür.
// Kullanım: node scripts/gen-i18n.mjs [prototip app klasörü]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const src = process.argv[2] || '/mnt/project-files/gu_kulupler/design/prototype/app';
const tr = {}; const en = {};
const GU = { defineDictionary(pairs) { for (const k in pairs) { tr[k] = pairs[k][0]; en[k] = pairs[k][1]; } } };
for (const f of ['i18n-dict.js', 'i18n-dict2.js']) vm.runInNewContext(fs.readFileSync(path.join(src, f), 'utf8'), { GU, window: {}, console });
const out = `/* Otomatik üretildi: scripts/gen-i18n.mjs — elle düzenleme. Kaynak: tasarım prototipi i18n sözlüğü. */\nexport const TR: Record<string, string> = ${JSON.stringify(tr, null, 0)};\nexport const EN: Record<string, string> = ${JSON.stringify(en, null, 0)};\n`;
fs.writeFileSync(new URL('../src/i18n/dict.ts', import.meta.url), out);
console.log('i18n keys:', Object.keys(tr).length);
