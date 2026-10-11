import { getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { C, ref } from '../db';
import { now } from '../fs';
import { DEFAULT_SETTINGS, type Settings, type ClubPrefs } from '../models';

export async function getSettings(uid: string): Promise<Settings> {
  const s = await getDoc(ref(C.settings, uid));
  if (!s.exists()) { await setDoc(ref(C.settings, uid), { ...DEFAULT_SETTINGS, updatedAt: now() }); return { ...DEFAULT_SETTINGS }; }
  return { ...DEFAULT_SETTINGS, ...(s.data() as Partial<Settings>), clubs: { ...((s.data().clubs as Settings['clubs']) || {}) } };
}
export type SettingsPatch = Partial<Omit<Settings, 'clubs' | 'updatedAt'>>;
export async function updateSettings(uid: string, patch: SettingsPatch) {
  await updateDoc(ref(C.settings, uid), { ...patch, updatedAt: now() });
}
export async function updateClubSettings(uid: string, clubId: string, prefs: ClubPrefs) {
  await updateDoc(ref(C.settings, uid), { [`clubs.${clubId}`]: prefs, updatedAt: now() });
}
