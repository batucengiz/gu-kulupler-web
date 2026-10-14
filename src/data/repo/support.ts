/* SupportRepository — TST-23 `#GU-XXXXXX`. */
import { setDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { C, col, ref } from '../db';
import { baseCreate, fromQuery, errCode } from '../fs';
import type { SupportTicket } from '../models';
import { supportTicketNo } from '../../lib/util';
import { prepareImage, upload, StoragePaths } from './storage';

/**
 * Belge kimliği talep numarasıdır (T-28). Numara tekilliğini kural sağlar: var olan numaraya yazım reddedilir;
 * bu durumda bir kez yeni numarayla (ek varsa yeni klasöre yeniden yükleyerek) denenir.
 */
export async function createTicket(p: { userId: string; subject: string; message: string; attachment?: File | null }): Promise<string> {
  const prepared = p.attachment ? await prepareImage(p.attachment) : null;
  const attempt = async () => {
    const ticketNo = supportTicketNo();
    const attachmentPaths: string[] = [];
    if (prepared) attachmentPaths.push(await upload(StoragePaths.support(ticketNo), prepared));
    await setDoc(ref(C.supportTickets, ticketNo), { ticketNo, userId: p.userId, subject: p.subject, message: p.message.trim(), attachmentPaths, status: 'open', ...baseCreate() });
    return ticketNo;
  };
  try { return await attempt(); }
  catch (e) { if (errCode(e) === 'permission-denied') return attempt(); throw e; }
}
export async function listMyTickets(userId: string): Promise<SupportTicket[]> {
  return fromQuery<SupportTicket>(await getDocs(query(col(C.supportTickets), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(50))));
}
