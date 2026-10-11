// Prototipte kullanılan Lucide ikonlarını src/ui/icon-data.ts dosyasına (yalnızca kullanılanlar) çıkarır.
import fs from 'node:fs';
import path from 'node:path';

const proto = process.argv[2] || '/mnt/project-files/gu_kulupler/design/prototype/app';
const iconsDir = new URL('../node_modules/lucide/dist/esm/icons/', import.meta.url);
const available = new Set(fs.readdirSync(iconsDir).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)));
const ALIASES = { 'check-circle': 'circle-check', 'x-circle': 'circle-x', 'alert-triangle': 'triangle-alert', 'help-circle': 'circle-help', unlock: 'lock-open', loader: 'loader-circle', 'loader-2': 'loader-circle', 'bar-chart-3': 'chart-column', 'pie-chart': 'chart-pie', 'line-chart': 'chart-line', 'code-2': 'code-xml' };
const names = new Set();
const files = ['icons.js', 'ui.js', 'cards.js', 'shell.js', 'art.js', 'screens-auth.js', 'screens-clubs.js', 'screens-events.js', 'screens-manage.js', 'screens-profile.js', 'screens-admin.js', 'sheets.js', 'dialogs.js', 'seed.js', 'core.js'];
for (const f of files) {
  const txt = fs.readFileSync(path.join(proto, f), 'utf8');
  for (const m of txt.matchAll(/['"`]([a-z][a-z0-9]*(?:-[a-z0-9]+)*)['"`]/g)) { const n = ALIASES[m[1]] || m[1]; if (available.has(n)) names.add(n); }
}
// web'e özgü ekler
['panel-left', 'log-out', 'camera-off', 'image-plus', 'grip-vertical', 'circle-dot', 'square-check', 'square'].forEach((n) => available.has(n) && names.add(n));
const data = {};
for (const n of [...names].sort()) {
  const src = fs.readFileSync(new URL(n + '.js', iconsDir), 'utf8');
  const m = src.match(/const \w+ = (\[[\s\S]*?\]);\n\nexport/);
  const arr = new Function('defaultAttributes', 'return ' + m[1])({});
  data[n] = arr[2];
}
const out = `/* Otomatik üretildi: scripts/gen-icons.mjs — Lucide v0.468 (ISC). */\nexport type IconNode = [string, Record<string, string | number>][];\nexport const ICONS: Record<string, IconNode> = ${JSON.stringify(data)};\nexport const ICON_ALIASES: Record<string, string> = ${JSON.stringify(ALIASES)};\n`;
fs.mkdirSync(new URL('../src/ui/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../src/ui/icon-data.ts', import.meta.url), out);
console.log('icons:', Object.keys(data).length);
