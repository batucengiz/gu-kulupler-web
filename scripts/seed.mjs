// Emülatörü temizler ve Flutter deposundaki demo verisini (226 kullanıcı, 14 kulüp, 3 292 belge) yükler.
// Yalnızca demo-* projesinde ve 127.0.0.1 emülatöründe çalışır; gerçek Firebase projesine dokunmaz.
//   npm run seed                      (seed betiği ../gu_kulupler/tool/seed/seed_emulator.js varsayılır)
//   GU_SEED_SCRIPT=/yol/seed_emulator.js npm run seed
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const PROJECT = 'demo-gu-kulupler';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export async function resetEmulator({ quiet = false } = {}) {
  if (!PROJECT.startsWith('demo-')) throw new Error('reset yalnız demo projelerinde');
  const seed = process.env.GU_SEED_SCRIPT
    || [path.resolve(ROOT, '..', 'gu_kulupler', 'tool', 'seed', 'seed_emulator.js'), '/mnt/project-files/gu_kulupler/tool/seed/seed_emulator.js'].find((f) => existsSync(f));
  if (!seed || !existsSync(seed)) throw new Error('seed betiği bulunamadı (GU_SEED_SCRIPT ile verin)');
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  execFileSync('node', [seed, '--project', PROJECT], {
    cwd: path.resolve(path.dirname(seed), '..', '..'), stdio: quiet ? ['ignore', 'ignore', 'inherit'] : 'inherit',
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199' },
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await resetEmulator();
