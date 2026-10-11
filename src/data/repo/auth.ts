/* AuthRepository — e-posta alan adı denetimi, giriş kısıtlayıcı (5 hata → 30 sn), doğrulama e-postası bekleme süresi (60 sn). */
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut, sendEmailVerification, sendPasswordResetEmail,
  updateProfile as fbUpdateProfile, verifyBeforeUpdateEmail, reload, reauthenticateWithCredential, updatePassword, EmailAuthProvider, type User as FbUser,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { AppError, errCode } from '../fs';
import { ALLOWED_EMAIL_DOMAINS, LIMITS } from '../../lib/constants';
import { readLocal, writeLocal } from '../../lib/store';

export const emailFormatOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());
export const emailDomainOk = (e: string) => ALLOWED_EMAIL_DOMAINS.some((d) => (e || '').trim().toLowerCase().endsWith('@' + d));

/* ---------- LoginThrottle (e-posta başına, yerel) ---------- */
const TKEY = 'gu.loginThrottle.v1';
type Throttle = Record<string, { fails: number; lockedUntil: number | null }>;
const readT = () => readLocal<Throttle>(TKEY, {});
export function loginLockRemaining(email: string): number {
  const r = readT()[email.trim().toLowerCase()]; if (!r?.lockedUntil) return 0;
  return Math.max(0, r.lockedUntil - Date.now());
}
export const lockedUntil = (email: string) => { const r = readT()[email.trim().toLowerCase()]; return r?.lockedUntil && r.lockedUntil > Date.now() ? r.lockedUntil : null; };
function recordFail(email: string): number {
  const all = readT(); const k = email.trim().toLowerCase(); const cur = all[k] || { fails: 0, lockedUntil: null };
  if (cur.lockedUntil && cur.lockedUntil <= Date.now()) { cur.fails = 0; cur.lockedUntil = null; }
  cur.fails += 1; if (cur.fails >= LIMITS.loginMaxFailedAttempts) cur.lockedUntil = Date.now() + LIMITS.loginLockoutMs;
  all[k] = cur; writeLocal(TKEY, all); return cur.fails;
}
function clearFails(email: string) { const all = readT(); delete all[email.trim().toLowerCase()]; writeLocal(TKEY, all); }

export async function signIn(email: string, password: string): Promise<FbUser> {
  const e = email.trim();
  if (!emailDomainOk(e)) throw new AppError('domainNotAllowed');
  if (loginLockRemaining(e) > 0) throw new AppError('lockedOut');
  try {
    const cred = await signInWithEmailAndPassword(auth, e, password);
    clearFails(e); return cred.user;
  } catch (err) {
    const c = errCode(err);
    if (['invalid-credential', 'wrong-password', 'user-not-found', 'invalid-email', 'invalid-login-credentials'].includes(c)) {
      const n = recordFail(e); throw new AppError(n >= LIMITS.loginMaxFailedAttempts ? 'lockedOut' : 'wrongCredentials');
    }
    if (c === 'too-many-requests') throw new AppError('tooManyRequests');
    if (c === 'network-request-failed') throw new AppError('network');
    if (c === 'user-disabled') throw new AppError('userDisabled');
    throw err;
  }
}
export async function register(name: string, email: string, password: string): Promise<FbUser> {
  const e = email.trim();
  if (!emailDomainOk(e)) throw new AppError('domainNotAllowed');
  try {
    const cred = await createUserWithEmailAndPassword(auth, e, password);
    try { await fbUpdateProfile(cred.user, { displayName: name.trim() }); } catch { /* ad profil kurulumunda yeniden istenir */ }
    try { await sendVerification(cred.user); } catch { /* AUT-03'te yeniden gönderilebilir */ }
    return cred.user;
  } catch (err) {
    const c = errCode(err);
    if (c === 'email-already-in-use') throw new AppError('emailExists');
    if (c === 'weak-password') throw new AppError('weakPassword');
    if (c === 'network-request-failed') throw new AppError('network');
    throw err;
  }
}
/* ---------- doğrulama e-postası (60 sn bekleme) ---------- */
const RKEY = 'gu.verifyResendAt.v1';
export const resendAvailableAt = () => readLocal<number>(RKEY, 0);
export async function sendVerification(u: FbUser | null = auth.currentUser) {
  if (!u) throw new AppError('notSignedIn');
  const at = resendAvailableAt(); if (at > Date.now()) throw new AppError('resendCooldown');
  try { await sendEmailVerification(u); }
  catch (err) { if (errCode(err) === 'too-many-requests') throw new AppError('tooManyRequests'); throw err; }
  writeLocal(RKEY, Date.now() + LIMITS.verificationResendCooldownMs);
}
/** AUT-03 "Doğruladım": kullanıcıyı yenile + belirteci zorla yenile (email_verified Rules'a yansısın). */
export async function checkVerified(): Promise<boolean> {
  const u = auth.currentUser; if (!u) throw new AppError('notSignedIn');
  await reload(u);
  if (!u.emailVerified) return false;
  await u.getIdToken(true);
  return true;
}
export async function changeUnverifiedEmail(newEmail: string) {
  const u = auth.currentUser; if (!u) throw new AppError('notSignedIn');
  if (!emailDomainOk(newEmail)) throw new AppError('domainNotAllowed');
  try { await verifyBeforeUpdateEmail(u, newEmail.trim()); }
  catch (err) {
    const c = errCode(err);
    if (c === 'email-already-in-use') throw new AppError('emailExists');
    if (c === 'requires-recent-login') throw new AppError('requiresRecentLogin');
    throw err;
  }
}
export async function resetPassword(email: string) {
  try { await sendPasswordResetEmail(auth, email.trim()); }
  catch (err) {
    const c = errCode(err);
    // kullanıcı yoksa da başarı gibi davranılır (hesap varlığı sızdırılmaz)
    if (c === 'user-not-found' || c === 'invalid-email') return;
    if (c === 'too-many-requests') throw new AppError('tooManyRequests');
    throw err;
  }
}
/** Şifre değiştir: mevcut şifreyle yeniden kimlik doğrulama + güncelleme. */
/** Hassas işlemlerden (şifre değişimi, hesap silme) önce mevcut şifreyle yeniden doğrulama. */
export async function reauth(current: string) {
  const u = auth.currentUser;
  if (!u || !u.email) throw new AppError('unauthenticated');
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
  } catch (err) {
    const c = errCode(err);
    if (['invalid-credential', 'wrong-password', 'invalid-login-credentials'].includes(c)) throw new AppError('wrongCredentials');
    if (c === 'too-many-requests') throw new AppError('tooManyRequests');
    if (c === 'network-request-failed') throw new AppError('network');
    throw err;
  }
  return u;
}
export async function changePassword(current: string, next: string) {
  const u = await reauth(current);
  try {
    await updatePassword(u, next);
  } catch (err) {
    const c = errCode(err);
    if (c === 'weak-password') throw new AppError('weakPassword');
    if (c === 'network-request-failed') throw new AppError('network');
    throw err;
  }
}
export const signOut = () => fbSignOut(auth);
export async function isSuperAdmin(u: FbUser, force = false): Promise<boolean> {
  try { const r = await u.getIdTokenResult(force); return r.claims.superadmin === true; } catch { return false; }
}
