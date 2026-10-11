/* Firestore yardımcıları: dönüştürme, ortak alanlar, soft delete — FirestoreService/BaseFieldsPayload/SoftDelete karşılığı. */
import { Timestamp, serverTimestamp, type DocumentSnapshot, type QuerySnapshot, type DocumentData, type FieldValue } from 'firebase/firestore';

function conv(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toMillis();
  if (Array.isArray(v)) return v.map(conv);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const o: Record<string, unknown> = {};
    for (const k in v as Record<string, unknown>) o[k] = conv((v as Record<string, unknown>)[k]);
    return o;
  }
  return v;
}
export function fromDoc<T>(snap: DocumentSnapshot<DocumentData>): T | null {
  if (!snap.exists()) return null;
  return { id: snap.id, ...(conv(snap.data({ serverTimestamps: 'estimate' })) as object) } as T;
}
export const fromQuery = <T,>(qs: QuerySnapshot<DocumentData>): T[] => qs.docs.map((d) => fromDoc<T>(d) as T);
export const ts = (ms: number) => Timestamp.fromMillis(ms);
export const now = (): FieldValue => serverTimestamp();

/** BaseFieldsPayload.create() */
export const baseCreate = () => ({ createdAt: now(), updatedAt: now(), isDeleted: false, deletedAt: null, deletedBy: null });
/** BaseFieldsPayload.update() */
export const touch = () => ({ updatedAt: now() });
/** SoftDelete.payload */
export const softDeletePayload = (actorId: string) => ({ isDeleted: true, deletedAt: now(), deletedBy: actorId, updatedAt: now() });
/** SoftDelete.restore */
export const restorePayload = () => ({ isDeleted: false, deletedAt: null, deletedBy: null, updatedAt: now() });

/** Uygulama hata kodları (FirestoreError/AuthError karşılığı). */
export class AppError extends Error {
  constructor(public code: string, message?: string) { super(message || code); }
}
export const isConflict = (e: unknown) => e instanceof AppError && e.code === 'conflict';
export function errCode(e: unknown): string {
  if (e instanceof AppError) return e.code;
  const c = (e as { code?: string })?.code || '';
  return c.replace(/^(auth|firestore|storage)\//, '');
}
