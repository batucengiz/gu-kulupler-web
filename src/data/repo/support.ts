/* SupportRepository — TST-23 `#GU-XXXXXX`. */
import { doc, collection, setDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { C, col } from '../db';
import { baseCreate, fromQuery } from '../fs';
import type { SupportTicket } from '../models';
import { supportTicketNo } from '../../lib/util';
import { prepareImage, upload, StoragePaths } from './storage';

export async function createTicket(p: { userId: string; subject: string; message: string; attachment?: File | null }): Promise<string> {
  const ticketNo = supportTicketNo();
  const attachmentPaths: string[] = [];
  if (p.attachment) attachmentPaths.push(await upload(StoragePaths.support(ticketNo), await prepareImage(p.attachment)));
  await setDoc(doc(collection(db, C.supportTickets)), { ticketNo, userId: p.userId, subject: p.subject, message: p.message.trim(), attachmentPaths, status: 'open', ...baseCreate() });
  return ticketNo;
}
export async function listMyTickets(userId: string): Promise<SupportTicket[]> {
  return fromQuery<SupportTicket>(await getDocs(query(col(C.supportTickets), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(50))));
}
