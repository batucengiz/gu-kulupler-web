import { getDoc, getDocs, query, where, setDoc, updateDoc } from 'firebase/firestore';
import { C, col, ref, ids } from '../db';
import { fromQuery, baseCreate, softDeletePayload, restorePayload } from '../fs';
import type { Block } from '../models';

export async function listBlocked(blockerId: string): Promise<Block[]> {
  const qs = await getDocs(query(col(C.blocks), where('blockerId', '==', blockerId), where('isDeleted', '==', false)));
  return fromQuery<Block>(qs);
}
export async function fetchActiveBlocks(blockerId: string): Promise<Set<string>> {
  return new Set((await listBlocked(blockerId)).map((b) => b.blockedId));
}
export async function block(blockerId: string, blockedId: string) {
  const r = ref(C.blocks, ids.block(blockerId, blockedId));
  const s = await getDoc(r);
  if (!s.exists()) await setDoc(r, { blockerId, blockedId, ...baseCreate() });
  else if (s.data().isDeleted) await updateDoc(r, restorePayload());
}
export async function unblock(blockerId: string, blockedId: string) {
  await updateDoc(ref(C.blocks, ids.block(blockerId, blockedId)), softDeletePayload(blockerId));
}
export async function restoreBlock(blockerId: string, blockedId: string) {
  await updateDoc(ref(C.blocks, ids.block(blockerId, blockedId)), restorePayload());
}
