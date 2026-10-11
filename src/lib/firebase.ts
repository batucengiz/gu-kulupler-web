/* Firebase başlatma — Flutter uygulamasıyla aynı proje (gu-kulupler). Değerler .env dosyasından gelir. */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const env = import.meta.env;
export const USE_EMULATOR = env.VITE_USE_EMULATOR === 'true';
const emulatorHost = env.VITE_EMULATOR_HOST || location.hostname || '127.0.0.1';

const config = USE_EMULATOR
  ? { apiKey: 'demo-api-key', authDomain: 'demo-gu-kulupler.firebaseapp.com', projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-gu-kulupler', storageBucket: (env.VITE_FIREBASE_PROJECT_ID || 'demo-gu-kulupler') + '.firebasestorage.app', appId: 'demo-app' }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'gu-kulupler.firebaseapp.com',
      projectId: env.VITE_FIREBASE_PROJECT_ID || 'gu-kulupler',
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'gu-kulupler.firebasestorage.app',
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '693709283304',
      appId: env.VITE_FIREBASE_APP_ID,
    };
export const firebaseConfigured = USE_EMULATOR || !!(config.apiKey && config.appId);

// Yapılandırma eksikse uygulama SYS-02 ekranını gösterir; Firebase SDK'sı yine de geçerli bir anahtarla başlatılmalı.
export const firebaseApp = initializeApp(firebaseConfigured ? config : { ...config, apiKey: 'missing-config', appId: 'missing-config' });
export const auth = getAuth(firebaseApp);
export const db = initializeFirestore(firebaseApp, {
  localCache: USE_EMULATOR ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});
export const storage = getStorage(firebaseApp);

if (USE_EMULATOR) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectStorageEmulator(storage, emulatorHost, 9199);
}
setPersistence(auth, browserLocalPersistence).catch(() => undefined);
